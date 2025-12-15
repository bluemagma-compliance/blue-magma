# Documentation Template Feature

## Overview
This document describes the documentation template feature that allows users to define a hierarchical template structure that AI agents will use to generate project documentation. The template defines the structure, sections, and format that AI agents should follow.

## Features

### 1. Hierarchical Page Structure ✅
- **Tree-based hierarchy** - Pages can have unlimited child pages
- **Visual tree navigation** - Expandable/collapsible tree view in sidebar
- **Nested levels** - Support for multiple levels of nesting
- **Drag-and-drop ordering** - (Future: Reorder pages within hierarchy)

### 2. Page Management ✅

#### Create Pages
- **Root pages** - Create top-level documentation pages
- **Child pages** - Add child pages under any existing page
- **Quick actions** - Create from sidebar or page context menu

#### Edit Pages
- **In-place editing** - Edit page title and content
- **Markdown editor** - Full markdown support with toolbar
- **Live preview** - Switch between edit and preview modes
- **Auto-save** - (Future: Automatic draft saving)

#### Delete Pages
- **Confirmation dialog** - Prevents accidental deletion
- **Cascade delete** - Warns when deleting pages with children
- **Undo** - (Future: Restore deleted pages)

### 3. Markdown Editor ✅

#### Toolbar Features
- **Headings** - H1, H2, H3 quick insert buttons
- **Text formatting** - Bold, italic buttons
- **Lists** - Bullet and numbered list templates
- **Tables** - Table template insertion
- **Code blocks** - Code block template
- **Links** - Link syntax helper

#### Supported Markdown
```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*

- Bullet list
- Item 2

1. Numbered list
2. Item 2

[Link text](https://example.com)

`inline code`

```
code block
```

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```

### 4. Live Preview ✅
- **Tab-based interface** - Switch between Edit and Preview
- **Rendered markdown** - See exactly how content will appear
- **Styled output** - Proper typography and spacing
- **Dark mode support** - Respects theme settings

### 5. Page Navigation ✅
- **Sidebar tree** - Browse all pages in hierarchy
- **Click to view** - Select any page to view content
- **Expand/collapse** - Show/hide child pages
- **Visual indicators** - Selected page highlighted

## User Interface

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Project: HIPAA Compliance                                      │
│  [Action] [Agent Tasks] [Documentation] [Reports]               │
├──────────────────┬─────────────────────────────────────────────┤
│                  │  [Template] Security Guidelines             │
│ Template      [+]│  This is a template that AI agents will use │
│ Structure        │  to generate documentation                  │
│ Define page      │                                             │
│ hierarchy        │  Template Preview: This markdown defines... │
│                  │                                             │
│  📄 Overview     │  # {Page Title}                            │
│  📄 Security     │                                             │
│    ▼ Guidelines  │  ## Overview                               │
│    📄 Auth       │  {Brief overview of this section}          │
│    📄 Encryption │                                             │
│  📄 Compliance   │  ## Key Requirements                       │
│                  │  - {Requirement 1}                         │
│                  │  - {Requirement 2}                         │
│                  │                                             │
│                  │  [Edit Template] [Delete]                  │
│                  │                                             │
└──────────────────┴─────────────────────────────────────────────┘
```

### Page Tree Actions

Each page in the tree has a context menu (⋮) with:
- **Edit Page** - Open editor dialog
- **Add Child Page** - Create a child under this page
- **Delete Page** - Remove page (with confirmation)

### Editor Dialog

```
┌─────────────────────────────────────────────────────────┐
│  New Documentation Page                              ✕  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Page Title *                                            │
│  [Security Guidelines_________________________]         │
│                                                          │
│  Description (Optional)                                  │
│  [Brief description...____________________]             │
│                                                          │
│  Content                                                 │
│  [Edit] [Preview]                                        │
│  ┌────────────────────────────────────────────────┐    │
│  │ [H1][H2][H3][B][I][List][1.2.3][Table][Code]  │    │
│  ├────────────────────────────────────────────────┤    │
│  │ # Security Guidelines                          │    │
│  │                                                 │    │
│  │ ## Authentication                              │    │
│  │ - Use OAuth 2.0                                │    │
│  │ - Implement MFA                                │    │
│  │                                                 │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│                              [Cancel] [Create Page]     │
└─────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Components

#### 1. `DocumentationTab` (`documentation-tab.tsx`)
**Purpose**: Main container for documentation feature

**State Management**:
```typescript
const [documentation, setDocumentation] = useState<DocumentPage[]>([]);
const [selectedPage, setSelectedPage] = useState<DocumentPage | null>(null);
const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
const [isEditorOpen, setIsEditorOpen] = useState(false);
const [editingPage, setEditingPage] = useState<DocumentPage | null>(null);
const [parentPageForNew, setParentPageForNew] = useState<DocumentPage | null>(null);
```

**Key Functions**:
- `renderPageTree()` - Recursively renders hierarchical page tree
- `handleCreatePage()` - Creates new page (root or child)
- `handleUpdatePage()` - Updates existing page
- `handleDeletePage()` - Deletes page and children
- `toggleExpanded()` - Expands/collapses tree nodes

#### 2. `DocumentationPageEditor` (`documentation-page-editor.tsx`)
**Purpose**: Dialog for creating/editing pages

**Features**:
- Title and description fields
- Tabbed markdown editor (Edit/Preview)
- Markdown toolbar with quick insert buttons
- Live preview with ReactMarkdown
- Form validation
- Error handling

**Props**:
```typescript
interface DocumentationPageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page?: DocumentPage | null; // null for new, DocumentPage for edit
  parentPage?: DocumentPage | null; // For creating child pages
  onSave: (pageData: {
    title: string;
    description?: string;
    content: string;
    parentId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}
```

### Data Structure

```typescript
export interface DocumentPage {
  id: string;
  title: string;
  content: string; // Markdown content
  order: number;
  children?: DocumentPage[];
  createdAt: string;
  updatedAt: string;
}
```

### CRUD Operations

#### Create Page
```typescript
const handleCreatePage = async (pageData: {
  title: string;
  description?: string;
  content: string;
  parentId?: string;
}) => {
  const newPage: DocumentPage = {
    id: `page-${Date.now()}`,
    title: pageData.title,
    content: pageData.content,
    order: documentation.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [],
  };

  if (pageData.parentId) {
    // Add as child to parent
    setDocumentation(updatePageChildren(documentation));
  } else {
    // Add as root page
    setDocumentation([...documentation, newPage]);
  }

  return { success: true };
};
```

#### Update Page
```typescript
const handleUpdatePage = async (pageData: {
  title: string;
  description?: string;
  content: string;
}) => {
  const updatePage = (pages: DocumentPage[]): DocumentPage[] => {
    return pages.map(page => {
      if (page.id === editingPage.id) {
        return {
          ...page,
          title: pageData.title,
          content: pageData.content,
          updatedAt: new Date().toISOString(),
        };
      }
      if (page.children) {
        return {
          ...page,
          children: updatePage(page.children),
        };
      }
      return page;
    });
  };

  setDocumentation(updatePage(documentation));
  return { success: true };
};
```

#### Delete Page
```typescript
const confirmDelete = () => {
  const deletePage = (pages: DocumentPage[]): DocumentPage[] => {
    return pages
      .filter(page => page.id !== pageToDelete.id)
      .map(page => ({
        ...page,
        children: page.children ? deletePage(page.children) : undefined,
      }));
  };

  setDocumentation(deletePage(documentation));
};
```

## Files Modified/Created

### Created
1. **`app/projects/components/documentation-page-editor.tsx`** - Page editor dialog
2. **`docs/DOCUMENTATION_TEMPLATE_FEATURE.md`** - This documentation

### Modified
1. **`app/projects/components/documentation-tab.tsx`** - Complete rewrite with CRUD
2. **`app/projects/[projectId]/page.tsx`** - Integrated DocumentationTab

## Current Status

### ✅ Implemented
- [x] Hierarchical page tree structure
- [x] Create root pages
- [x] Create child pages
- [x] Edit pages
- [x] Delete pages (with cascade warning)
- [x] Markdown editor with toolbar
- [x] Live preview
- [x] Page navigation
- [x] Expand/collapse tree
- [x] Context menu actions
- [x] Delete confirmation dialog
- [x] Empty state UI

### 🔄 Mock Implementation (Frontend Only)
- [x] All CRUD operations work in-memory
- [x] State persists during session
- [x] No backend integration yet

### 🚧 Future Enhancements
- [ ] Backend API integration
- [ ] Persist to database
- [ ] Drag-and-drop reordering
- [ ] Auto-save drafts
- [ ] Version history
- [ ] Page templates
- [ ] Search within documentation
- [ ] Export to PDF/HTML
- [ ] Collaborative editing
- [ ] Comments and annotations
- [ ] Page permissions

## Usage Examples

### Creating a Documentation Structure

```
Project Documentation
├── Overview
├── Getting Started
│   ├── Installation
│   ├── Configuration
│   └── First Steps
├── Security Guidelines
│   ├── Authentication
│   ├── Authorization
│   └── Data Encryption
├── API Reference
│   ├── REST Endpoints
│   ├── WebSocket Events
│   └── Error Codes
└── Compliance
    ├── HIPAA Requirements
    ├── SOC 2 Controls
    └── Audit Procedures
```

### Example Page Content

```markdown
# Security Guidelines

## Overview
This document outlines the security requirements and best practices for the HIPAA Compliance Project.

## Authentication

### OAuth 2.0
All API endpoints must use OAuth 2.0 for authentication:
- Use authorization code flow for web applications
- Implement PKCE for mobile apps
- Token expiration: 1 hour

### Multi-Factor Authentication (MFA)
MFA is required for:
- Admin users
- Access to PHI (Protected Health Information)
- Production environment access

## Data Encryption

### At Rest
| Data Type | Encryption Method |
|-----------|-------------------|
| Database  | AES-256          |
| Files     | AES-256          |
| Backups   | AES-256          |

### In Transit
- TLS 1.3 minimum
- Perfect Forward Secrecy (PFS)
- Certificate pinning for mobile apps

## Code Example

```python
from oauth2 import OAuth2Client

client = OAuth2Client(
    client_id="your_client_id",
    client_secret="your_client_secret"
)

token = client.get_access_token()
```

## References
- [HIPAA Security Rule](https://example.com)
- [NIST Cybersecurity Framework](https://example.com)
```

## Testing Checklist

- [x] Create root page
- [x] Create child page
- [x] Edit page title
- [x] Edit page content
- [x] Delete page without children
- [x] Delete page with children (shows warning)
- [x] Expand/collapse tree nodes
- [x] Select different pages
- [x] Markdown toolbar buttons work
- [x] Preview tab shows rendered markdown
- [x] Empty state shows when no pages
- [x] Context menu appears on hover
- [x] No TypeScript errors
- [x] No console errors
- [x] Responsive design works


