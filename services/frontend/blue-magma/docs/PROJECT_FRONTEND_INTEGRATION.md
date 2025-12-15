# Project Management Frontend Integration

## Overview
This document describes the frontend integration with the backend project management API. The implementation follows existing patterns for authentication, server actions, and UI components.

## Files Created/Modified

### Created Files (3 new files)

1. **`app/projects/actions.ts`** - Server actions for project CRUD operations
2. **`app/projects/components/create-project-dialog.tsx`** - Dialog for creating new projects
3. **`app/projects/components/edit-project-dialog.tsx`** - Dialog for editing existing projects

### Modified Files (2 files)

1. **`app/projects/page.tsx`** - Updated to use real API data instead of mock data
2. **`app/projects/[projectId]/page.tsx`** - Updated to use real API data and added edit/delete functionality

## Architecture

### Server Actions Pattern

Following the existing pattern from `app/codebases/actions.ts`, all API calls are made through server actions:

```typescript
// Helper functions (reused across all actions)
async function getAuthHeaders() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  
  if (!accessToken) {
    throw new Error("No access token available");
  }
  
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function getOrganizationId(): Promise<string> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("organization_id")?.value;
  
  if (!orgId) {
    throw new Error("No organization ID available");
  }
  
  return orgId;
}
```

### API Integration

All server actions follow this pattern:

1. Get organization ID from httpOnly cookies
2. Get auth headers with JWT token from httpOnly cookies
3. Make fetch request to backend API
4. Handle errors gracefully
5. Revalidate paths when data changes

## Server Actions

### 1. `getProjects()`
**Purpose**: Fetch all projects for the current organization

**Returns**: `Promise<Project[]>`

**Example**:
```typescript
const projects = await getProjects();
```

### 2. `getProjectById(projectId: string)`
**Purpose**: Fetch a single project by ID

**Returns**: `Promise<Project | null>`

**Example**:
```typescript
const project = await getProjectById("proj-uuid-123");
```

### 3. `createProject(projectData: CreateProjectRequest)`
**Purpose**: Create a new project

**Parameters**:
- `name` (required): Project name
- `description` (optional): Project description
- `status` (optional): 'active' | 'completed' | 'on-hold'
- `compliance_score` (optional): 0-100

**Returns**: `Promise<{ success: boolean; project?: Project; error?: string }>`

**Example**:
```typescript
const result = await createProject({
  name: "HIPAA Compliance",
  description: "Healthcare compliance project",
  status: "active"
});

if (result.success) {
  console.log("Created:", result.project);
}
```

### 4. `updateProject(projectId: string, projectData: UpdateProjectRequest)`
**Purpose**: Update an existing project

**Parameters**:
- `name` (optional): Updated project name
- `description` (optional): Updated description
- `status` (optional): Updated status
- `compliance_score` (optional): Updated score

**Returns**: `Promise<{ success: boolean; project?: Project; error?: string }>`

**Example**:
```typescript
const result = await updateProject("proj-uuid-123", {
  status: "completed",
  compliance_score: 95.0
});
```

### 5. `deleteProject(projectId: string)`
**Purpose**: Delete a project

**Returns**: `Promise<{ success: boolean; error?: string }>`

**Example**:
```typescript
const result = await deleteProject("proj-uuid-123");
if (result.success) {
  router.push('/projects');
}
```

## UI Components

### Projects List Page (`/projects`)

**Features**:
- ✅ Loads projects from backend on mount
- ✅ Loading state with spinner
- ✅ Empty state with "Create Project" CTA
- ✅ Project cards with compliance score, status badge
- ✅ "New Project" button opens create dialog
- ✅ Automatic refresh after creating project

**State Management**:
```typescript
const [projects, setProjects] = useState<APIProject[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

useEffect(() => {
  loadProjects();
}, []);

const loadProjects = async () => {
  setIsLoading(true);
  const data = await getProjects();
  setProjects(data);
  setIsLoading(false);
};
```

### Project Detail Page (`/projects/[projectId]`)

**Features**:
- ✅ Loads project from backend on mount
- ✅ Loading state with spinner
- ✅ 404 state for non-existent projects
- ✅ Edit project via dropdown menu
- ✅ Delete project with confirmation dialog
- ✅ Compliance score display with color coding
- ✅ Status badge
- ✅ Placeholder tabs for future features

**Actions Menu**:
- Edit Project → Opens edit dialog
- Delete Project → Opens confirmation dialog

### CreateProjectDialog Component

**Features**:
- ✅ Form validation (name required)
- ✅ Default status: "active"
- ✅ Loading state during submission
- ✅ Error handling with error messages
- ✅ Form reset on close/success
- ✅ Prevents closing during submission

**Fields**:
- Name (required)
- Description (optional)
- Status (dropdown: active/on-hold/completed)

### EditProjectDialog Component

**Features**:
- ✅ Pre-populated with current project data
- ✅ Form validation (name required, score 0-100)
- ✅ Loading state during submission
- ✅ Error handling with error messages
- ✅ Form reset on close
- ✅ Prevents closing during submission

**Fields**:
- Name (required)
- Description (optional)
- Status (dropdown: active/on-hold/completed)
- Compliance Score (number input: 0-100)

## Authentication & Security

### httpOnly Cookies
All authentication is handled via httpOnly cookies (cannot be accessed by client-side JavaScript):
- `access_token` - JWT access token
- `organization_id` - Current organization ID

### Server Actions Only
Client components **cannot** directly access tokens. All API calls must go through server actions that run on the server and have access to httpOnly cookies.

### Organization Scoping
All API endpoints are organization-scoped:
```
/api/v1/org/:org_id/project
```

The organization ID is automatically retrieved from cookies and validated by the backend middleware.

## Data Flow

### Creating a Project

```
User clicks "New Project"
  ↓
CreateProjectDialog opens
  ↓
User fills form and submits
  ↓
handleCreateProject() called
  ↓
createProject() server action
  ↓
Server: Get org_id from cookies
  ↓
Server: Get auth headers from cookies
  ↓
Server: POST /api/v1/org/{org_id}/project
  ↓
Backend: Validate JWT
  ↓
Backend: Check org ownership
  ↓
Backend: Create project in DB
  ↓
Server: Revalidate /projects path
  ↓
Dialog closes, projects list refreshes
```

### Editing a Project

```
User clicks "Edit Project" in dropdown
  ↓
EditProjectDialog opens with current data
  ↓
User modifies fields and submits
  ↓
handleUpdateProject() called
  ↓
updateProject() server action
  ↓
Server: PUT /api/v1/org/{org_id}/project/{project_id}
  ↓
Backend: Update project in DB
  ↓
Server: Revalidate paths
  ↓
Dialog closes, project page refreshes
```

### Deleting a Project

```
User clicks "Delete Project" in dropdown
  ↓
Confirmation dialog opens
  ↓
User confirms deletion
  ↓
handleDeleteProject() called
  ↓
deleteProject() server action
  ↓
Server: DELETE /api/v1/org/{org_id}/project/{project_id}
  ↓
Backend: Delete project from DB
  ↓
Server: Revalidate /projects path
  ↓
Redirect to /projects list
```

## Error Handling

### Network Errors
```typescript
try {
  const result = await createProject(data);
  if (result.success) {
    // Success
  } else {
    setError(result.error);
  }
} catch (err) {
  setError("An unexpected error occurred");
}
```

### 404 Handling
```typescript
if (!response.ok) {
  if (response.status === 404) {
    return null; // or []
  }
  throw new Error(`Failed to fetch: ${response.status}`);
}
```

### User Feedback
- Loading spinners during async operations
- Error messages in red alert boxes
- Success feedback via UI updates (dialog closes, list refreshes)

## Future Enhancements

The following features are placeholders and will be implemented later:

1. **Project Tasks** - Manual task management
2. **Agent Tasks** - Automated workflow execution
3. **Documentation** - Markdown documentation pages
4. **Data Sources** - Link codebases, documents, users to projects
5. **Reports** - Compliance report generation

These will require additional backend endpoints and frontend components.

## Testing Checklist

- [ ] Create project with all fields
- [ ] Create project with only name (defaults)
- [ ] Create project with invalid data (validation)
- [ ] View projects list
- [ ] View empty projects list
- [ ] View single project
- [ ] View non-existent project (404)
- [ ] Edit project name
- [ ] Edit project status
- [ ] Edit project compliance score
- [ ] Edit with invalid data (validation)
- [ ] Delete project
- [ ] Cancel delete project
- [ ] Test without authentication (should fail)
- [ ] Test with wrong organization (should not see projects)

## API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/org/:org_id/project` | List all projects |
| GET | `/api/v1/org/:org_id/project/:project_id` | Get single project |
| POST | `/api/v1/org/:org_id/project` | Create project |
| PUT | `/api/v1/org/:org_id/project/:project_id` | Update project |
| DELETE | `/api/v1/org/:org_id/project/:project_id` | Delete project |

All endpoints require:
- JWT authentication via `Authorization: Bearer <token>` header
- Organization ownership validation
- Proper role permissions (user for read, admin for write)

