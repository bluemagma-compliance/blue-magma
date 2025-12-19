# Project Templates Frontend Implementation Plan

**Version:** 1.0  
**Date:** 2025-10-29  
**Status:** Planning Phase

---

## Overview

Implement frontend support for Project Templates feature. Users can now create projects from pre-built templates (HIPAA, SOX, etc.) that include documentation structure and policy templates. This plan outlines the implementation in phases.

---

## Phase 1: Type Definitions & API Integration

### 1.1 Update Type Definitions (`types.ts`)

Add new types:
- `ProjectTemplate` - Template metadata (id, name, description, category, active)
- `PolicyTemplate` - Policy template structure (id, title, description, content, category)
- `ProjectTemplateDetail` - Full template with documentation pages and policies

### 1.2 Create Server Actions (`actions.ts`)

Add new server actions:
- `getProjectTemplates()` - GET `/api/v1/project-template` - List all templates
- `getProjectTemplateById(templateId)` - GET `/api/v1/project-template/{id}` - Get template details
- `createProjectFromTemplate(projectData, templateId)` - POST with `template_id` parameter
- `getProjectPolicies(projectId)` - GET `/api/v1/org/{orgId}/project/{projectId}/policy-template`
- `getPolicyById(projectId, policyId)` - GET single policy
- `updatePolicy(projectId, policyId, data)` - PUT policy
- `createPolicy(projectId, data)` - POST new policy
- `deletePolicy(projectId, policyId)` - DELETE policy

---

## Phase 2: Template Selection UI

### 2.1 Create Template Browser Component

**File:** `components/template-browser.tsx`

Features:
- Grid/list view of available templates
- Filter by category (Security, Privacy, Compliance, Operations, Legal)
- Search by name/description
- Template cards showing: name, description, category, policy count
- "Preview" button to view template details
- "Use Template" button to select

### 2.2 Create Template Preview Modal

**File:** `components/template-preview-modal.tsx`

Features:
- Show template name, description, category
- Display documentation page structure (tree view)
- List policy templates with titles and descriptions
- "Use This Template" button
- "Cancel" button

---

## Phase 3: Enhanced Project Creation

### 3.1 Update CreateProjectDialog

**File:** `components/create-project-dialog.tsx` (modify)

Changes:
- Add "Use Template?" toggle/radio at top
- If template selected:
  - Show template browser
  - Show selected template preview
  - Hide codebase selection (keep for future)
- If no template:
  - Show current form (name, description, status)
- Update `onCreateProject` callback to accept optional `template_id`

### 3.2 Update Project Creation Flow

**File:** `page.tsx` (modify)

Changes:
- Update `handleCreateProject` to pass `template_id` if selected
- Show loading state during creation (may take longer with template)
- Show success message indicating policies/docs were created

---

## Phase 4: Policies Tab in Project Detail

### 4.1 Create Policies Tab Component

**File:** `components/policies-tab.tsx` (new)

Features:
- List all project policies in table/card view
- Columns: Title, Category, Description, Actions
- Search/filter by category
- "Add Policy" button
- Edit/Delete actions per policy
- Show policy content in modal/drawer

### 4.2 Create Policy Editor Component

**File:** `components/policy-editor.tsx` (new)

Features:
- Modal dialog for editing/creating policies
- Fields: Title, Description, Category (dropdown), Content (markdown)
- Markdown editor with preview tabs
- Save/Cancel buttons
- Error handling

### 4.3 Update Project Detail Page

**File:** `[projectId]/page.tsx` (modify)

Changes:
- Add "Policies" tab to tab list (after Documentation)
- Import and render PoliciesTab component
- Update ProjectTab type to include 'policies'

---

## Phase 5: Policy Management Features

### 5.1 Policy Display Component

**File:** `components/policy-viewer.tsx` (new)

Features:
- Read-only markdown rendering of policy content
- Show metadata (title, category, created date)
- Copy content button
- Download as markdown button

### 5.2 Bulk Operations

**File:** `components/policies-tab.tsx` (enhance)

Features:
- Select multiple policies
- Bulk delete with confirmation
- Bulk export as ZIP

---

## Phase 6: Integration & Polish

### 6.1 Update Navigation

- Add "Policies" to project tabs
- Update breadcrumbs if applicable

### 6.2 Error Handling

- Handle template fetch failures
- Handle policy CRUD errors
- Show appropriate error messages

### 6.3 Loading States

- Show skeleton loaders for template list
- Show loading spinner during policy operations
- Disable buttons during async operations

### 6.4 Empty States

- Show helpful message when no templates available
- Show helpful message when no policies in project
- Show CTA to create first policy

---

## Implementation Order

1. **Phase 1** - Type definitions & API actions (foundation)
2. **Phase 2** - Template browser & preview (discovery)
3. **Phase 3** - Enhanced project creation (core flow)
4. **Phase 4** - Policies tab & editor (management)
5. **Phase 5** - Policy features (polish)
6. **Phase 6** - Integration & UX (refinement)

---

## Key Considerations

### Data Flow
- Templates are **public** (all orgs see same templates)
- Project instances are **private** (org-scoped)
- Policies created from template are **independent** (editing doesn't affect template)

### API Contracts
- All policy endpoints are org/project scoped
- Template endpoints are global (no org scope)
- Responses include full markdown content

### UX Patterns
- Template selection should be optional (support both flows)
- Policy editing should be inline or modal (not separate page)
- Markdown content should have preview capability

---

## Testing Strategy

- Unit tests for new server actions
- Component tests for UI components
- Integration tests for template → project creation flow
- E2E tests for full user journey

---

## Success Criteria

✅ Users can browse and select templates  
✅ Projects created from templates include docs + policies  
✅ Users can view/edit/delete policies in project  
✅ Policy changes don't affect template or other projects  
✅ All CRUD operations work correctly  
✅ Error handling is robust  
✅ UX is intuitive and polished

