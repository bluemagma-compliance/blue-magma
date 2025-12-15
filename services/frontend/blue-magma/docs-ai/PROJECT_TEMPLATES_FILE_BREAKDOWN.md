# Project Templates - File-by-File Breakdown

**Version:** 1.0  
**Date:** 2025-10-29

---

## Files to Create (New)

### 1. `app/projects/components/template-browser.tsx`
**Purpose:** Display available templates in grid/list view  
**Key Features:**
- Fetch and display all templates
- Filter by category (Security, Privacy, Compliance, Operations, Legal)
- Search by name/description
- Template cards with: name, description, category badge, policy count
- "Preview" button → opens template-preview-modal
- "Use Template" button → callback to parent
- Loading/empty states

**Props:**
```typescript
interface TemplateBrowserProps {
  onSelectTemplate: (templateId: string) => void;
  onPreview: (templateId: string) => void;
}
```

---

### 2. `app/projects/components/template-preview-modal.tsx`
**Purpose:** Show full template details before selection  
**Key Features:**
- Display template metadata (name, description, category)
- Show documentation page tree structure (read-only)
- List all policy templates with titles/descriptions
- "Use This Template" button
- "Cancel" button
- Loading state while fetching template details

**Props:**
```typescript
interface TemplatePreviewModalProps {
  templateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseTemplate: (templateId: string) => void;
}
```

---

### 3. `app/projects/components/policies-tab.tsx`
**Purpose:** Main policies management interface in project detail  
**Key Features:**
- List all project policies in table or card view
- Search/filter by category
- "Add Policy" button → opens policy-editor
- Edit/Delete actions per policy
- Show policy metadata (title, category, created date)
- Empty state when no policies
- Loading state

**Props:**
```typescript
interface PoliciesTabProps {
  projectId: string;
}
```

---

### 4. `app/projects/components/policy-editor.tsx`
**Purpose:** Modal for creating/editing policies  
**Key Features:**
- Form fields: Title, Description, Category (dropdown), Content (markdown)
- Markdown editor with syntax highlighting
- Edit/Preview tabs for content
- Markdown toolbar (H1-H3, bold, italic, lists, tables, code, links)
- Save/Cancel buttons
- Validation (title required)
- Error handling
- Loading state during save

**Props:**
```typescript
interface PolicyEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: PolicyTemplate | null;
  projectId: string;
  onSave: (data: PolicyData) => Promise<void>;
}
```

---

### 5. `app/projects/components/policy-viewer.tsx`
**Purpose:** Read-only display of policy content  
**Key Features:**
- Render markdown content with syntax highlighting
- Show metadata (title, category, created date)
- Copy content button
- Download as markdown button
- Print button
- Breadcrumb navigation

**Props:**
```typescript
interface PolicyViewerProps {
  policy: PolicyTemplate;
  onClose: () => void;
}
```

---

## Files to Modify (Existing)

### 1. `app/projects/types.ts`
**Changes:**
- Add `ProjectTemplate` interface
- Add `PolicyTemplate` interface
- Add `ProjectTemplateDetail` interface
- Update `Project` type to include `policyTemplates?: PolicyTemplate[]`
- Add `PolicyCategory` type

**New Types:**
```typescript
type PolicyCategory = 'Security' | 'Privacy' | 'Compliance' | 'Operations' | 'Legal';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  createdAt: string;
}

interface PolicyTemplate {
  id: string;
  title: string;
  description: string;
  content: string; // markdown
  category: PolicyCategory;
  createdAt: string;
  updatedAt: string;
}

interface ProjectTemplateDetail extends ProjectTemplate {
  documentation: DocumentPage[];
  policies: PolicyTemplate[];
}
```

---

### 2. `app/projects/actions.ts`
**Changes:**
- Add 5 new server actions for templates
- Add 4 new server actions for policies
- Update `createProject` to accept optional `template_id`

**New Actions:**
```typescript
// Templates
getProjectTemplates()
getProjectTemplateById(templateId: string)
createProjectFromTemplate(projectData, templateId)

// Policies
getProjectPolicies(projectId: string)
getPolicyById(projectId: string, policyId: string)
updatePolicy(projectId: string, policyId: string, data)
createPolicy(projectId: string, data)
deletePolicy(projectId: string, policyId: string)
```

---

### 3. `app/projects/components/create-project-dialog.tsx`
**Changes:**
- Add template selection UI at top
- Add toggle: "Use Template" vs "Start from Scratch"
- If template selected:
  - Show template browser component
  - Show selected template preview
  - Hide codebase selection
- Update form submission to pass `template_id`
- Update success message to mention policies/docs

---

### 4. `app/projects/page.tsx`
**Changes:**
- Update `handleCreateProject` to accept `template_id`
- Pass `template_id` to `createProject` action
- Show enhanced success message if template was used
- Handle longer creation time (show appropriate loading message)

---

### 5. `app/projects/[projectId]/page.tsx`
**Changes:**
- Add "Policies" to ProjectTab type
- Add "Policies" tab to TabsList
- Import PoliciesTab component
- Add TabsContent for policies
- Update tab count from 4 to 5

---

## Server Action Implementation Details

### Template Actions
- **getProjectTemplates()**: GET `/api/v1/project-template`
  - Returns: `ProjectTemplate[]`
  - No auth required (public)

- **getProjectTemplateById(id)**: GET `/api/v1/project-template/{id}`
  - Returns: `ProjectTemplateDetail`
  - Includes docs + policies

- **createProjectFromTemplate(data, templateId)**: POST `/api/v1/org/{orgId}/project`
  - Body: `{ name, description, template_id }`
  - Returns: Full project with docs + policies

### Policy Actions
- **getProjectPolicies(projectId)**: GET `/api/v1/org/{orgId}/project/{projectId}/policy-template`
  - Returns: `PolicyTemplate[]`

- **getPolicyById(projectId, policyId)**: GET `/api/v1/org/{orgId}/project/{projectId}/policy-template/{policyId}`
  - Returns: `PolicyTemplate`

- **updatePolicy(projectId, policyId, data)**: PUT `/api/v1/org/{orgId}/project/{projectId}/policy-template/{policyId}`
  - Body: `{ title, description, content, category }`
  - Returns: Updated `PolicyTemplate`

- **createPolicy(projectId, data)**: POST `/api/v1/org/{orgId}/project/{projectId}/policy-template`
  - Body: `{ title, description, content, category }`
  - Returns: Created `PolicyTemplate`

- **deletePolicy(projectId, policyId)**: DELETE `/api/v1/org/{orgId}/project/{projectId}/policy-template/{policyId}`
  - Returns: 204 No Content

---

## Component Hierarchy

```
Projects Page
├── Create Project Dialog
│   ├── Template Browser
│   │   └── Template Preview Modal
│   └── Project Form (existing)
└── Project List

Project Detail Page
├── Tabs Container
│   ├── Documentation Tab (existing)
│   ├── Policies Tab (NEW)
│   │   ├── Policy List
│   │   ├── Policy Editor Modal (NEW)
│   │   └── Policy Viewer Modal (NEW)
│   ├── Agent Tasks Tab (existing)
│   └── Reports Tab (existing)
```

---

## Data Flow Summary

1. **Template Selection**: User → Template Browser → Template Preview → Select
2. **Project Creation**: Form → Server Action → Backend → Response with docs + policies
3. **Policy Management**: List → Edit/Create/Delete → Server Action → Backend → Update UI
4. **Policy Viewing**: List → Click → Policy Viewer → Display markdown

---

## Testing Checklist

- [ ] Template browser loads and displays templates
- [ ] Template preview shows correct structure
- [ ] Project creation with template works
- [ ] Policies load for project
- [ ] Policy CRUD operations work
- [ ] Error handling for all operations
- [ ] Loading states display correctly
- [ ] Empty states display correctly
- [ ] Markdown rendering works
- [ ] Search/filter functionality works

