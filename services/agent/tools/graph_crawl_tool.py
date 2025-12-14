# Native Graph Crawl Implementation
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import time

# LLM client interfaces
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

# Optional Neo4j driver detection (kept self-contained within tool)
try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    # Commented instead of removing: When neo4j is not installed, we run in mock/demo mode
    # Rationale: Keep tool importable even without Neo4j dependency
    GraphDatabase = None
    NEO4J_AVAILABLE = False

class GraphCrawlClient:
    """Handles Neo4j interactions for native crawling"""

    def __init__(self, neo4j_uri: str = "bolt://neo4j", neo4j_auth: tuple = ("neo4j", "password123")):
        if not NEO4J_AVAILABLE:
            self.driver = None
            print("⚠️ Neo4j not available - GraphCrawlClient will return mock data")
        else:
            try:
                self.driver = GraphDatabase.driver(neo4j_uri, auth=neo4j_auth)
            except Exception as e:
                print(f"⚠️ Failed to connect to Neo4j: {e}")
                self.driver = None

    def get_root_node(self, codebase_version_id: str) -> Optional[Dict[str, Any]]:
        """Find the root node for a codebase version"""
        if not self.driver:
            # Return mock data when Neo4j is not available
            return {
                "full_path": f"/{codebase_version_id}",
                "name": codebase_version_id,
                "summary": "Mock root node for testing"
            }

        safe_codebase_version = ''.join(c for c in codebase_version_id if c.isalnum() or c == '_')
        codebase_label = f"PathNode_{safe_codebase_version}"

        # Use exact same query pattern as seeker-agent crawler.py
        query = f"""
        MATCH (root:`{codebase_label}`)
        WHERE NOT ( ()-[:CONTAINS]->(root) )
        OPTIONAL MATCH (root)-[:CONTAINS]->(descendant)
        RETURN root, descendant, elementId(root) AS root_element_id
        """

        try:
            with self.driver.session() as session:
                result = session.run(query)
                records = list(result)

                if records:
                    # Get the root node from first record (same as seeker-agent)
                    root_node = dict(records[0]["root"])
                    return root_node
                else:
                    return None
        except Exception as e:
            print(f"⚠️ Neo4j query failed: {e}")
            return None

    def get_node_children(self, node_path: str, codebase_version_id: str) -> List[Dict[str, Any]]:
        """Get children of a specific node"""
        if not self.driver:
            # Return mock children for testing
            if node_path.endswith(codebase_version_id):
                return [
                    {"path": f"{node_path}/api", "name": "api", "summary": "API endpoints and handlers"},
                    {"path": f"{node_path}/auth", "name": "auth", "summary": "Authentication and authorization"},
                    {"path": f"{node_path}/models", "name": "models", "summary": "Data models and schemas"}
                ]
            elif "api" in node_path:
                return [
                    {"path": f"{node_path}/users.py", "name": "users.py", "summary": "User management endpoints"},
                    {"path": f"{node_path}/auth.py", "name": "auth.py", "summary": "Authentication endpoints"}
                ]
            else:
                return []  # Leaf nodes

        safe_codebase_version = ''.join(c for c in codebase_version_id if c.isalnum() or c == '_')
        codebase_label = f"PathNode_{safe_codebase_version}"

        query = f"""
        MATCH (parent:`{codebase_label}` {{full_path: $node_path}})-[:CONTAINS]->(child)
        RETURN child.full_path AS path, child.name AS name, child.summary AS summary
        """

        try:
            with self.driver.session() as session:
                result = session.run(query, node_path=node_path)
                return [dict(record) for record in result]
        except Exception as e:
            print(f"⚠️ Neo4j query failed: {e}")
            return []

    def get_node_properties(self, node_path: str, codebase_version_id: str) -> List[Dict[str, Any]]:
        """Get properties of a specific node"""
        if not self.driver:
            # Return mock properties for testing
            if "users.py" in node_path:
                return [
                    {"type": "function", "name": "create_user", "description": "Creates new user account"},
                    {"type": "function", "name": "get_user_data", "description": "Retrieves user personal data"},
                    {"type": "security", "name": "input_validation", "description": "Validates user input"}
                ]
            elif "auth.py" in node_path:
                return [
                    {"type": "function", "name": "authenticate", "description": "User authentication"},
                    {"type": "security", "name": "jwt_validation", "description": "JWT token validation"}
                ]
            else:
                return []

        safe_codebase_version = ''.join(c for c in codebase_version_id if c.isalnum() or c == '_')
        codebase_label = f"PathNode_{safe_codebase_version}"

        query = f"""
        MATCH (node:`{codebase_label}` {{full_path: $node_path}})
        RETURN node.properties AS properties, node.summary AS summary
        """

        try:
            with self.driver.session() as session:
                result = session.run(query, node_path=node_path)
                record = result.single()
                if record and record["properties"]:
                    return record["properties"]
                return []
        except Exception as e:
            print(f"⚠️ Neo4j query failed: {e}")
            return []

    def close(self):
        """Close the Neo4j driver"""
        if self.driver:
            try:
                self.driver.close()
            except Exception as e:
                print(f"⚠️ Error closing Neo4j driver: {e}")


class NativeCrawlTool:
    """Native graph crawling tool for GraphLang agent"""

    def __init__(self, llm_client: ChatOpenAI):
        self.llm_client = llm_client
        self.graph_client = GraphCrawlClient()
        self.neo4j_available = NEO4J_AVAILABLE

    async def execute_crawl(self,
                           codebase_version_id: str,
                           org_id: str,  # TODO: org_id not currently used but may be needed for future multi-tenant features
                           analysis_criteria: str,
                           original_question: str = None,
                           max_depth: int = 10,
                           max_nodes: int = 50) -> Dict[str, Any]:
        """Execute native graph crawl with user question context"""

        await emit_workflow_thought("Sending crawlers out to explore the codebase...", "native_crawl")

        # Check if Neo4j is available
        # if not self.neo4j_available:
            #await emit_workflow_thought("⚠️ Neo4j not available - running in demo mode with mock data", "native_crawl")

        start_time = time.time()
        visited_nodes = []
        relevant_properties = []

        try:
            # Step 1: Find root node
            # #await emit_data_thought(f"🔍 Finding root node for codebase: {codebase_version_id}", "native_crawl")
            root_node = self.graph_client.get_root_node(codebase_version_id)

            if not root_node:
                # #await emit_error_thought(f"❌ No root node found for codebase: {codebase_version_id}", "native_crawl")
                return {"error": "Root node not found", "visited_nodes": 0, "properties_found": 0}

            # #await emit_data_thought(f"✅ Found root node: {root_node.get('full_path', 'unknown')}", "native_crawl")

            # Step 2: Start recursive crawl
            crawl_results = await self._recursive_crawl(
                node_path=root_node["full_path"],
                codebase_version_id=codebase_version_id,
                analysis_criteria=analysis_criteria,
                original_question=original_question,
                visited_nodes=visited_nodes,
                relevant_properties=relevant_properties,
                current_depth=0,
                max_depth=max_depth,
                max_nodes=max_nodes
            )

            execution_time = time.time() - start_time

            # Step 3: Generate final summary
            # #await emit_workflow_thought("📊 Generating crawl summary...", "native_crawl")
            summary = await self._generate_crawl_summary(crawl_results, analysis_criteria, execution_time)

            # Create traces for each relevant property found
            traces_created = []
            for prop in relevant_properties:
                trace_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "tool_name": "graph_crawl",
                    "trace_type": "property",
                    "data": {
                        "property": prop.get("property", ""),
                        "relevance_reason": prop.get("relevance_reason", ""),
                        "importance": prop.get("importance", "medium"),
                        "node_path": prop.get("node_path", ""),
                        "task_context": analysis_criteria
                    },
                    "relevance_score": 0.8 if prop.get("importance") == "high" else 0.6 if prop.get("importance") == "medium" else 0.4,
                    "importance": prop.get("importance", "medium"),
                    "source_location": prop.get("node_path", ""),
                    "node_path": prop.get("node_path", "")
                }
                traces_created.append(trace_entry)

            # Create traces for visited nodes
            for node in visited_nodes:
                if node.get("type") == "leaf" and node.get("relevant_properties_count", 0) > 0:
                    trace_entry = {
                        "timestamp": datetime.now().isoformat(),
                        "tool_name": "graph_crawl",
                        "trace_type": "node",
                        "data": {
                            "path": node.get("path", ""),
                            "type": node.get("type", ""),
                            "properties_count": node.get("properties_count", 0),
                            "relevant_properties_count": node.get("relevant_properties_count", 0),
                            "depth": node.get("depth", 0),
                            "task_context": analysis_criteria
                        },
                        "relevance_score": min(1.0, node.get("relevant_properties_count", 0) / 5.0),  # Scale by properties found
                        "importance": "high" if node.get("relevant_properties_count", 0) > 2 else "medium",
                        "source_location": node.get("path", ""),
                        "node_path": node.get("path", "")
                    }
                    traces_created.append(trace_entry)

            #await emit_data_thought(f"📝 Created {len(traces_created)} crawl traces", "native_crawl")

            final_results = {
                "traversal_summary": {
                    "nodes_visited": len(visited_nodes),
                    "total_properties_found": len(relevant_properties),
                    "execution_time": f"{execution_time:.1f} seconds",
                    "traversal_path": [node["path"] for node in visited_nodes[:10]]  # First 10 for brevity
                },
                "relevant_properties": relevant_properties,
                "node_analysis": visited_nodes,
                "summary": summary,
                "success": True,
                "traces_created": traces_created  # Include traces in return
            }

            #await emit_workflow_thought(f"✅ Crawl completed: {len(visited_nodes)} nodes, {len(relevant_properties)} properties", "native_crawl")
            return final_results

        except Exception as e:
            #await emit_error_thought(f"❌ Crawl failed: {str(e)}", "native_crawl")
            return {"error": str(e), "visited_nodes": len(visited_nodes), "properties_found": len(relevant_properties)}

    async def _recursive_crawl(self,
                              node_path: str,
                              codebase_version_id: str,
                              analysis_criteria: str,
                              original_question: str,
                              visited_nodes: List[Dict[str, Any]],
                              relevant_properties: List[Dict[str, Any]],
                              current_depth: int,
                              max_depth: int,
                              max_nodes: int) -> Dict[str, Any]:
        """Recursively crawl the graph"""

        # Check limits
        if current_depth >= max_depth or len(visited_nodes) >= max_nodes:
            #await emit_data_thought(f"🛑 Reached limits: depth={current_depth}, nodes={len(visited_nodes)}", "native_crawl")
            return {"status": "limit_reached"}

        # Get node children
        children = self.graph_client.get_node_children(node_path, codebase_version_id)

        if not children:
            # Leaf node - analyze properties
            #await emit_data_thought(f"🍃 Analyzing leaf node: {node_path}", "native_crawl")
            properties = self.graph_client.get_node_properties(node_path, codebase_version_id)

            if properties:
                relevant_props = await self._analyze_node_properties(properties, analysis_criteria, node_path)
                relevant_properties.extend(relevant_props)

                visited_nodes.append({
                    "path": node_path,
                    "type": "leaf",
                    "properties_count": len(properties),
                    "relevant_properties_count": len(relevant_props),
                    "depth": current_depth
                })
        else:
            # Directory node - select children to visit
            #await emit_data_thought(f"📁 Selecting children for: {node_path} ({len(children)} children)", "native_crawl")
            selected_children = await self._select_relevant_children(children, analysis_criteria, original_question)

            visited_nodes.append({
                "path": node_path,
                "type": "directory",
                "children_count": len(children),
                "selected_children": len(selected_children),
                "depth": current_depth
            })

            # Recursively visit selected children
            for child in selected_children:
                if len(visited_nodes) < max_nodes:
                    await self._recursive_crawl(
                        node_path=child["path"],
                        codebase_version_id=codebase_version_id,
                        analysis_criteria=analysis_criteria,
                        original_question=original_question,
                        visited_nodes=visited_nodes,
                        relevant_properties=relevant_properties,
                        current_depth=current_depth + 1,
                        max_depth=max_depth,
                        max_nodes=max_nodes
                    )

        return {"status": "completed"}

    async def _select_relevant_children(self, children: List[Dict[str, Any]], criteria: str, original_question: str = None) -> List[Dict[str, Any]]:
        """Use LLM to select which children to visit"""

        if not children:
            return []

        # Prepare children summaries for LLM
        children_info = []
        for child in children:
            children_info.append({
                "name": child.get("name", "unknown"),
                "path": child.get("path", "unknown"),
                "summary": child.get("summary", "No summary available")[:200]  # Truncate long summaries
            })

        # Build context-aware prompt
        context_info = f"Analysis criteria: \"{criteria}\""
        if original_question:
            context_info = f"Original user question: \"{original_question}\"\nAnalysis criteria: \"{criteria}\""

        prompt = f"""Given the context:
{context_info}

Analyze these child nodes and select which ones are most likely to contain relevant information:

{json.dumps(children_info, indent=2)}

Select the top 3-5 most relevant nodes. Consider:
- Relevance to the original user question (if provided)
- Relevance to the analysis criteria
- Likelihood of containing useful properties
- Structural importance

tests are not always relevant so you can give them a lower priority

Return a JSON list of node names to visit, ordered by priority."""

        try:
            #await emit_llm_thought("🤖 Selecting relevant children nodes..." + prompt, "native_crawl")
            response = await self.llm_client.ainvoke([HumanMessage(content=prompt)])

            # Parse LLM response to get selected node names
            selected_names = self._parse_node_selection(response.content)

            # Return matching children
            selected_children = []
            for name in selected_names:
                for child in children:
                    if child.get("name") == name or name in child.get("path", ""):
                        selected_children.append(child)
                        break

            #await emit_data_thought(f"🎯 Selected {len(selected_children)} children from {len(children)} options", "native_crawl")
            return selected_children[:5]  # Limit to 5 children max

        except Exception as e:
            #await emit_error_thought(f"⚠️ LLM selection failed, using first 3 children: {str(e)}", "native_crawl")
            return children[:3]  # Fallback to first 3 children

    async def _analyze_node_properties(self, properties: List[Dict[str, Any]], criteria: str, node_path: str) -> List[Dict[str, Any]]:
        """Use LLM to analyze and filter node properties"""

        if not properties:
            return []

        # Prepare properties for LLM analysis
        properties_text = json.dumps(properties, indent=2)[:2000]  # Limit size

        prompt = f"""Analyze these code properties for relevance to: "{criteria}"

            Node: {node_path}
            Properties: {properties_text}

            Extract properties that are relevant to the analysis criteria. For each relevant property:
            1. Describe what it is
            2. Explain why it's relevant to "{criteria}"
            3. Assess its importance (high/medium/low)

            Return a JSON list of relevant properties with this structure:
            [
            {{
                "property": "description of the property",
                "relevance_reason": "why it's relevant",
                "importance": "high/medium/low",
                "node_path": "{node_path}"
            }}
            ]

            Only include properties that are clearly relevant to the criteria."""

        try:
            #await emit_llm_thought(f"🔍 Analyzing properties for: {node_path}" + prompt, "native_crawl")
            response = await self.llm_client.ainvoke([HumanMessage(content=prompt)])

            # Parse LLM response
            relevant_props = self._parse_property_analysis(response.content, node_path)

            # if relevant_props:
            #     #await emit_data_thought(f"✅ Found {len(relevant_props)} relevant properties in {node_path}", "native_crawl")
            #     # Show the actual data found
            #     for prop in relevant_props:
            #         #await emit_data_thought(f"  📊 DATA FOUND: {prop.get('property', 'Unknown')} (Importance: {prop.get('importance', 'Unknown')})", "native_crawl")
            #         #await emit_data_thought(f"      Reason: {prop.get('relevance_reason', 'No reason provided')}", "native_crawl")
            # else:
            #     #await emit_data_thought(f"❌ No relevant properties found in {node_path}", "native_crawl")

            return relevant_props

        except Exception as e:
            #await emit_error_thought(f"⚠️ Property analysis failed for {node_path}: {str(e)}", "native_crawl")
            return []

    async def _generate_crawl_summary(self, crawl_results: Dict[str, Any], criteria: str, execution_time: float) -> str:
        """Generate a summary of the crawl results"""

        prompt = f"""Generate a concise summary of this graph crawl analysis.

            Analysis Criteria: "{criteria}"
            Execution Time: {execution_time:.1f} seconds

            Crawl Results: {json.dumps(crawl_results, indent=2)[:1500]}

            Provide a summary that includes:
            1. What was analyzed
            2. Key findings related to the criteria
            3. Overall assessment
            4. Any recommendations

            Keep it concise but informative."""

        try:
            #await emit_llm_thought("📝 Generating crawl summary...", "native_crawl")
            response = await self.llm_client.ainvoke([HumanMessage(content=prompt)])
            return response.content

        except Exception as e:
            #await emit_error_thought(f"⚠️ Summary generation failed: {str(e)}", "native_crawl")
            return f"Crawl completed in {execution_time:.1f} seconds. Analysis criteria: {criteria}"

    def _parse_node_selection(self, llm_response: str) -> List[str]:
        """Parse LLM response to extract selected node names"""
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\[.*?\]', llm_response, re.DOTALL)
            if json_match:
                selected_nodes = json.loads(json_match.group())
                return [str(node) for node in selected_nodes]

            # Fallback: extract lines that look like node names
            lines = llm_response.split('\n')
            node_names = []
            for line in lines:
                line = line.strip()
                if line and not line.startswith(('Given', 'Analysis', 'Consider', 'Return')):
                    # Remove common prefixes
                    for prefix in ['- ', '* ', '1. ', '2. ', '3. ', '4. ', '5. ']:
                        if line.startswith(prefix):
                            line = line[len(prefix):]
                    if line:
                        node_names.append(line)

            return node_names[:5]  # Limit to 5

        except Exception:
            return []

    def _parse_property_analysis(self, llm_response: str, node_path: str) -> List[Dict[str, Any]]:
        """Parse LLM response to extract relevant properties"""
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\[.*?\]', llm_response, re.DOTALL)
            if json_match:
                properties = json.loads(json_match.group())
                # Ensure each property has required fields
                for prop in properties:
                    if "node_path" not in prop:
                        prop["node_path"] = node_path
                return properties

            # Fallback: create simple properties from text
            return [{
                "property": "Analysis completed but could not parse detailed properties",
                "relevance_reason": "LLM response parsing failed",
                "importance": "low",
                "node_path": node_path
            }]

        except Exception:
            return []

    def close(self):
        """Clean up resources"""
        self.graph_client.close()
