from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import requests
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

# Thought emitters (support package and top-level runs)
try:
    from ..emitters.thought_emitter import (
        emit_workflow_thought,
        emit_data_thought,
        emit_error_thought,
    )
except ImportError:
    from emitters.thought_emitter import (
        emit_workflow_thought,
        emit_data_thought,
        emit_error_thought,
    )


class RAGQueryCodeTool:
    """RAG tool for querying actual code content"""

    def __init__(self, llm_client: ChatOpenAI):
        self.llm_client = llm_client
        self.rag_daddy_url = "http://rag-daddy:8000"

    async def execute_query(self,
                           codebase_version_id: str,
                           version_hash: str,
                           org_id: str,
                           task_context: str,
                           original_question: str = None,
                           previous_results: Dict[str, Any] = None,
                           target_paths: List[str] = None) -> Dict[str, Any]:
        """Execute RAG query for actual code content"""

        await emit_workflow_thought("Searching relevant code snippets", "rag_code")

        try:
            # Generate focused questions based on task context and previous results
            questions = await self._generate_questions_for_code(task_context, original_question, previous_results, target_paths)

            #await emit_data_thought(f"📝 Generated {len(questions)} questions for code search", "rag_code")
            #await emit_data_thought(f"🔍 RAG Code Questions: {json.dumps(questions, indent=2)}", "rag_code")

            # Execute queries
            code_results = []
            for i, question_info in enumerate(questions):
                #await emit_data_thought(f"🔧 Executing code query {i+1}/{len(questions)}: {question_info['question']}", "rag_code")
                result = await self._execute_single_code_query(
                    question_info, codebase_version_id, version_hash, org_id
                )
                #await emit_data_thought(f"📊 Code Query {i+1} Results: {len(result.get('results', []))} items found", "rag_code")
                code_results.append(result)

            # Process and format results
            formatted_results = self._format_code_results(code_results)

            #await emit_data_thought(f"✅ Found {len(formatted_results.get('code_snippets', []))} relevant code snippets", "rag_code")
            #await emit_data_thought(f"📊 RAG Code Formatted Results: {json.dumps(formatted_results, indent=2)}", "rag_code")

            # Create traces for each relevant code snippet found
            traces_created = []
            for snippet_info in formatted_results.get('code_snippets', []):
                trace_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "tool_name": "rag_code",
                    "trace_type": "code_snippet",
                    "data": {
                        "name": snippet_info.get("name", ""),
                        "path": snippet_info.get("path", ""),
                        "code": snippet_info.get("code", "")[:500],  # Truncate long code
                        "from_line": snippet_info.get("from_line", 0),
                        "to_line": snippet_info.get("to_line", 0),
                        "type": snippet_info.get("type", ""),
                        "score": snippet_info.get("score", 0),
                        "question": snippet_info.get("question", ""),
                        "task_context": task_context
                    },
                    "relevance_score": snippet_info.get("score", 0),
                    "importance": "high" if snippet_info.get("score", 0) > 0.8 else "medium" if snippet_info.get("score", 0) > 0.5 else "low",
                    "source_location": snippet_info.get("path", ""),
                    "node_path": snippet_info.get("path", "")
                }
                traces_created.append(trace_entry)

            #await emit_data_thought(f"📝 Created {len(traces_created)} code snippet traces", "rag_code")

            return {
                "tool_name": "rag_query_code",
                "questions_asked": [q["question"] for q in questions],
                "code_results": code_results,
                "formatted_results": formatted_results,
                "total_snippets_found": len(formatted_results.get('code_snippets', [])),
                "traces_created": traces_created  # Include traces in return
            }

        except Exception as e:
            #await emit_error_thought(f"❌ RAG code query error: {str(e)}", "rag_code")
            return {"error": str(e)}

    async def _generate_questions_for_code(self, task_context: str, original_question: str = None, previous_results: Dict[str, Any] = None, target_paths: List[str] = None) -> List[Dict[str, Any]]:
        """Generate focused questions for finding relevant code content"""

        context_info = f"Task context: {task_context}"
        if original_question:
            context_info += f"\nOriginal question: {original_question}"

        previous_context = ""
        if previous_results:
            previous_context = f"\nPrevious tool results: {self._summarize_previous_results(previous_results)}"

        target_context = ""
        if target_paths:
            target_context = f"\nTarget paths to focus on: {', '.join(target_paths[:5])}"

        prompt = f"""Generate 2-4 focused search questions to find relevant code content.

{context_info}{previous_context}{target_context}

Generate questions that will help find:
- Specific code implementations
- Security-related code patterns
- Configuration or setup code
- Error handling or validation logic

Return as a JSON array of objects with format:
[{{"question": "search query", "type": "file_type_hint"}}]

Example: [{{"question": "find input validation functions", "type": "function"}}]"""

        try:
            response = await self.llm_client.ainvoke([HumanMessage(content=prompt)])
            questions_text = response.content.strip()

            # Enhanced JSON parsing with better error handling
            import json
            try:
                # Try direct JSON parsing first
                if questions_text.startswith('[') and questions_text.endswith(']'):
                    parsed_questions = json.loads(questions_text)
                    # Validate the structure
                    if isinstance(parsed_questions, list) and all(isinstance(q, dict) and 'question' in q for q in parsed_questions):
                        return parsed_questions

                # Try to extract JSON from markdown code blocks
                if '```json' in questions_text:
                    json_start = questions_text.find('```json') + 7
                    json_end = questions_text.find('```', json_start)
                    if json_end > json_start:
                        json_content = questions_text[json_start:json_end].strip()
                        parsed_questions = json.loads(json_content)
                        if isinstance(parsed_questions, list) and all(isinstance(q, dict) and 'question' in q for q in parsed_questions):
                            return parsed_questions

                # Try to extract JSON from the response (look for [ ... ])
                import re
                json_match = re.search(r'\[.*?\]', questions_text, re.DOTALL)
                if json_match:
                    parsed_questions = json.loads(json_match.group())
                    if isinstance(parsed_questions, list) and all(isinstance(q, dict) and 'question' in q for q in parsed_questions):
                        return parsed_questions

            except json.JSONDecodeError as json_err:
                print(f"❌ JSON parsing failed: {json_err}")
                #await emit_error_thought(f"❌ JSON parsing failed: {json_err}", "rag_code")
                #await emit_error_thought(f"🔍 Raw LLM response: {questions_text[:200]}...", "rag_code")

            # Fallback: extract questions from text manually
            # REMOVED: Old line-by-line parsing that was creating malformed questions
            # Reason: Was treating JSON syntax elements as individual questions
            #await emit_data_thought("🔄 Using fallback question extraction", "rag_code")
            fallback_questions = self._extract_questions_from_text(questions_text, task_context)
            return fallback_questions

        except Exception as e:
            #await emit_error_thought(f"❌ Error generating code questions: {e}", "rag_code")
            # Fallback questions based on task context
            return self._create_fallback_code_questions(task_context, original_question)

    def _extract_questions_from_text(self, text: str, task_context: str) -> List[Dict[str, Any]]:
        """Extract meaningful questions from LLM text response when JSON parsing fails"""
        questions = []

        # Look for lines that seem like questions
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            # Skip empty lines, JSON syntax, and markdown
            if not line or line in ['[', ']', '{', '}', '```json', '```']:
                continue
            # Skip lines that are just JSON syntax
            if line.startswith('"') and line.endswith('",'):
                continue
            # Look for actual question content
            if any(keyword in line.lower() for keyword in ['find', 'search', 'locate', 'identify', 'get', 'show']):
                # Clean up the line
                clean_question = line.strip('",{}[]')
                if len(clean_question) > 10:  # Reasonable question length
                    questions.append({"question": clean_question, "type": None})

        # If no good questions found, create from task context
        if not questions:
            questions = self._create_fallback_code_questions(task_context, None)

        return questions[:4]  # Limit to 4 questions

    def _create_fallback_code_questions(self, task_context: str, original_question: str = None) -> List[Dict[str, Any]]:
        """Create fallback questions when LLM generation fails"""
        base_questions = [
            f"find code related to: {task_context}",
            f"search for functions handling: {task_context}",
        ]

        if original_question:
            base_questions.append(f"locate code that addresses: {original_question}")

        # Add context-specific questions
        if "data" in task_context.lower():
            base_questions.append("find data processing or storage functions")
        elif "auth" in task_context.lower():
            base_questions.append("find authentication or authorization code")
        elif "security" in task_context.lower():
            base_questions.append("find security validation or encryption code")
        else:
            base_questions.append("find relevant implementation code")

        return [{"question": q, "type": None} for q in base_questions[:4]]

    async def _execute_single_code_query(self, question_info: Dict[str, Any], codebase_version_id: str, version_hash: str, org_id: str) -> Dict[str, Any]:
        """Execute a single code query against RAG daddy"""

        try:
            import requests
            payload = {
                "question": question_info["question"],
                "codebase_version": codebase_version_id,
                "version_hash": version_hash,
                "org_id": org_id
            }

            # Set type to None to match Seeker agent approach
            payload["type"] = None
            # Remove path filter - leave path empty for now

            #await emit_data_thought(f"📡 RAG Code Query Payload: {json.dumps(payload, indent=2)}", "rag_code")

            response = requests.post(
                f"{self.rag_daddy_url}/query-code",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            #await emit_data_thought(f"📊 RAG Code Response Status: {response.status_code}", "rag_code")

            if response.status_code != 200:
                #await emit_error_thought(f"❌ RAG code query failed: {response.status_code} - {response.text}", "rag_code")
                return {
                    "question": question_info["question"],
                    "error": f"Query failed: {response.status_code}",
                    "results": []
                }

            result = response.json()
            #await emit_data_thought(f"📋 RAG Code Raw Result: {json.dumps(result, indent=2)}", "rag_code")
            return {
                "question": question_info["question"],
                "type_filter": None,
                "results": result.get("results", [])
            }

        except Exception as e:
            return {
                "question": question_info["question"],
                "error": str(e),
                "results": []
            }

    def _format_code_results(self, code_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Format RAG code results for easier consumption"""

        code_snippets = []

        for query_result in code_results:
            if query_result.get("error"):
                continue

            question = query_result["question"]

            for result in query_result.get("results", []):
                code_snippets.append({
                    "code": result.get("code", ""),
                    "path": result.get("path", ""),
                    "from_line": result.get("from_line", 0),
                    "to_line": result.get("to_line", 0),
                    "name": result.get("name", ""),
                    "type": result.get("type", ""),
                    "score": result.get("score", 0),
                    "question": question
                })

        # Sort by score and limit results
        sorted_snippets = sorted(code_snippets, key=lambda x: x['score'], reverse=True)

        return {
            "code_snippets": sorted_snippets[:15],  # Top 15 results
            "total_found": len(sorted_snippets),
            "queries_executed": len(code_results)
        }

    def _summarize_previous_results(self, previous_results: Dict[str, Any]) -> str:
        """Create a brief summary of previous tool results for context"""

        summaries = []
        for tool_name, result in previous_results.items():
            if isinstance(result, dict):
                if result.get("error"):
                    summaries.append(f"{tool_name}: failed")
                elif "names" in result:
                    count = len(result.get("names", []))
                    summaries.append(f"{tool_name}: found {count} names")
                elif "code_results" in result:
                    count = len(result.get("code_results", []))
                    summaries.append(f"{tool_name}: found {count} code snippets")
                else:
                    summaries.append(f"{tool_name}: completed")

        return "; ".join(summaries) if summaries else "No previous results"
