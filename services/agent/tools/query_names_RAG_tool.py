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

class RAGQueryNamesTool:
    """RAG tool for querying function/class names and declarations"""

    def __init__(self, llm_client: ChatOpenAI):
        self.llm_client = llm_client
        self.rag_daddy_url = "http://rag-daddy:8000"

    async def execute_query(self,
                           codebase_version_id: str,
                           version_hash: str,
                           org_id: str,
                           task_context: str,
                           original_question: str = None,
                           previous_results: Dict[str, Any] = None) -> Dict[str, Any]:
        """Execute RAG query for names/declarations"""

        await emit_workflow_thought("Finding relevant classes, functions and imports", "rag_names")

        try:
            # Generate focused questions based on task context and previous results
            questions = await self._generate_questions_for_names(task_context, original_question, previous_results)

            #await emit_data_thought(f"📝 Generated {len(questions)} questions for names search", "rag_names")
            #await emit_data_thought(f"🔍 RAG Names Questions: {questions}", "rag_names")

            # Query RAG daddy for names - wrap question in array as required by API
            import requests
            # Use first question if multiple generated
            single_question = questions[0] if questions else "find relevant names"
            payload = {
                "questions": [single_question],  # API expects questions array
                "codebase_version": codebase_version_id,
                "version_hash": version_hash,
                "org_id": org_id,
                "type": None
            }

            #await emit_data_thought(f"📡 RAG Names Payload: {json.dumps(payload, indent=2)}", "rag_names")

            response = requests.post(
                f"{self.rag_daddy_url}/query-names",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            #await emit_data_thought(f"📊 RAG Names Response Status: {response.status_code}", "rag_names")

            if response.status_code != 200:
                #await emit_error_thought(f"❌ RAG names query failed: {response.status_code} - {response.text}", "rag_names")
                return {"error": f"RAG query failed: {response.status_code}"}

            results = response.json()
            #await emit_data_thought(f"📋 RAG Names Raw Results: {json.dumps(results, indent=2)}", "rag_names")

            # Process and format results
            formatted_results = self._format_names_results(results, [single_question])

            #await emit_data_thought(f"✅ Found {len(formatted_results.get('names', []))} relevant names", "rag_names")
            #await emit_data_thought(f"📊 RAG Names Formatted Results: {json.dumps(formatted_results, indent=2)}", "rag_names")

            # Create traces for each relevant name found
            traces_created = []
            for name_info in formatted_results.get('names', []):
                trace_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "tool_name": "rag_names",
                    "trace_type": "name",
                    "data": {
                        "name": name_info.get("name", ""),
                        "type": name_info.get("type", ""),
                        "path": name_info.get("path", ""),
                        "score": name_info.get("score", 0),
                        "question": name_info.get("question", ""),
                        "task_context": task_context
                    },
                    "relevance_score": name_info.get("score", 0),
                    "importance": "high" if name_info.get("score", 0) > 0.8 else "medium" if name_info.get("score", 0) > 0.5 else "low",
                    "source_location": name_info.get("path", ""),
                    "node_path": name_info.get("path", "")
                }
                traces_created.append(trace_entry)

            #await emit_data_thought(f"📝 Created {len(traces_created)} name traces", "rag_names")

            return {
                "tool_name": "rag_query_names",
                "questions_asked": [single_question],
                "raw_results": results,
                "formatted_results": formatted_results,
                "total_names_found": len(formatted_results.get('names', [])),
                "traces_created": traces_created  # Include traces in return
            }

        except Exception as e:
            #await emit_error_thought(f"❌ RAG names query error: {str(e)}", "rag_names")
            return {"error": str(e)}

    async def _generate_questions_for_names(self, task_context: str, original_question: str = None, previous_results: Dict[str, Any] = None) -> List[str]:
        """Generate focused questions for finding relevant names/declarations"""

        context_info = f"Task context: {task_context}"
        if original_question:
            context_info += f"\nOriginal question: {original_question}"

        previous_context = ""
        if previous_results:
            previous_context = f"\nPrevious tool results: {self._summarize_previous_results(previous_results)}"

        prompt = f"""Generate 2-4 focused search questions to find relevant function names, class names, or other code declarations.

{context_info}{previous_context}

Generate questions that will help find:
- Function names that might be relevant
- Class names that could contain relevant code
- Module/file names that might have relevant declarations
- Variable or constant names that might be important

Return as a JSON array of strings. Each question should be specific and focused on finding names/declarations.

Example format: ["find authentication functions", "locate user validation classes", "search for security-related constants"]"""

        try:
            response = await self.llm_client.ainvoke([HumanMessage(content=prompt)])
            questions_text = response.content.strip()

            # Enhanced JSON parsing for names questions
            import json
            try:
                # Try direct JSON parsing
                if questions_text.startswith('[') and questions_text.endswith(']'):
                    parsed_questions = json.loads(questions_text)
                    if isinstance(parsed_questions, list) and all(isinstance(q, str) for q in parsed_questions):
                        return parsed_questions

                # Try to extract JSON from markdown code blocks
                if '```json' in questions_text:
                    json_start = questions_text.find('```json') + 7
                    json_end = questions_text.find('```', json_start)
                    if json_end > json_start:
                        json_content = questions_text[json_start:json_end].strip()
                        parsed_questions = json.loads(json_content)
                        if isinstance(parsed_questions, list) and all(isinstance(q, str) for q in parsed_questions):
                            return parsed_questions

                # Try to extract JSON array from response
                import re
                json_match = re.search(r'\[.*?\]', questions_text, re.DOTALL)
                if json_match:
                    parsed_questions = json.loads(json_match.group())
                    if isinstance(parsed_questions, list) and all(isinstance(q, str) for q in parsed_questions):
                        return parsed_questions

            except json.JSONDecodeError as json_err:
                print(f"❌ Names JSON parsing failed: {json_err}")
                #await emit_error_thought(f"❌ Names JSON parsing failed: {json_err}", "rag_names")
                #await emit_error_thought(f"🔍 Raw LLM response: {questions_text[:200]}...", "rag_names")

            # Fallback: extract questions from text manually
            # REMOVED: Simple line splitting that could include JSON syntax
            # Reason: Was including malformed JSON elements as questions
            #await emit_data_thought("🔄 Using fallback question extraction for names", "rag_names")
            return self._create_fallback_names_questions(task_context, original_question)

        except Exception as e:
            #await emit_error_thought(f"❌ Error generating names questions: {e}", "rag_names")
            return self._create_fallback_names_questions(task_context, original_question)

    def _create_fallback_names_questions(self, task_context: str, original_question: str = None) -> List[str]:
        """Create fallback questions for names search when LLM generation fails"""
        base_questions = [
            f"find function names related to: {task_context}",
            f"search for class names handling: {task_context}",
        ]

        if original_question:
            base_questions.append(f"locate declarations for: {original_question}")

        # Add context-specific questions
        if "data" in task_context.lower():
            base_questions.append("find data model or handler function names")
        elif "auth" in task_context.lower():
            base_questions.append("find authentication or authorization function names")
        elif "security" in task_context.lower():
            base_questions.append("find security or validation function names")
        else:
            base_questions.append("find relevant function or class names")

        return base_questions[:4]  # Limit to 4 questions

    def _format_names_results(self, raw_results: Dict[str, Any], questions: List[str]) -> Dict[str, Any]:
        """Format RAG names results for easier consumption"""

        names = []
        results_by_question = raw_results.get("results", [])

        for i, question_results in enumerate(results_by_question):
            question = questions[i] if i < len(questions) else f"Question {i+1}"

            for result in question_results.get("results", []):
                names.append({
                    "name": result.get("name", ""),
                    "path": result.get("path", ""),
                    "type": result.get("type", ""),
                    "score": result.get("score", 0),
                    "question": question
                })

        # Sort by score and remove duplicates
        unique_names = {}
        for name_info in names:
            key = f"{name_info['name']}:{name_info['path']}"
            if key not in unique_names or name_info['score'] > unique_names[key]['score']:
                unique_names[key] = name_info

        sorted_names = sorted(unique_names.values(), key=lambda x: x['score'], reverse=True)

        return {
            "names": sorted_names[:20],  # Top 20 results
            "total_found": len(sorted_names),
            "questions_asked": questions
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
