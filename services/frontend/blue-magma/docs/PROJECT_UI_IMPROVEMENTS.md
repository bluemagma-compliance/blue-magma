# Project UI Improvements

## Overview
This document describes the UI improvements made to the project management interface based on user feedback.

## Changes Made

### 1. Removed Duplicate Status Display on Project Cards ✅

**Before**: Project cards showed the status twice:
- Once as a colored badge (green pill) in the header
- Again as a text field in the card content

**After**: Only the colored status badge is shown in the header.

**Files Modified**:
- `app/projects/page.tsx`

**Code Change**:
Removed the redundant status display section:
```typescript
// REMOVED:
<div className="flex items-center justify-between text-sm">
  <span className="text-muted-foreground flex items-center">
    <Clock className="mr-1 h-3 w-3" />
    Status
  </span>
  <span className="font-medium capitalize">
    {project.status}
  </span>
</div>
```

**Result**: Cleaner card design with status only shown once as a colored badge.

---

### 2. Added Data Source Selector to Create Project Dialog ✅

**Feature**: When creating a project, users can now select which data sources (codebases) to associate with the project.

**Behavior**:
- ✅ All codebases are selected by default
- ✅ "Select All" checkbox to toggle all at once
- ✅ Expandable list to view and select individual codebases
- ✅ Shows count of selected codebases (e.g., "3/5 selected")
- ✅ Scrollable list if there are many codebases (max-height: 12rem)

**Empty State**:
When no data sources exist, shows a friendly message:
```
There's nothing here... 👀

We could just stare at each other, but my guess is you 
probably just want to add some data sources instead 😉

[Add Data Sources] (button linking to /data-sources)
```

**Files Modified**:
- `app/projects/components/create-project-dialog.tsx`

**New Features Added**:
1. **Load codebases on dialog open**
   - Fetches all codebases using `getCodebases()` server action
   - Shows loading spinner while fetching
   - Automatically selects all codebases by default

2. **Select All functionality**
   - Checkbox to select/deselect all codebases at once
   - Shows count: "Codebases (3/5 selected)"

3. **Expandable list**
   - Chevron icon to expand/collapse individual codebase list
   - Collapsed by default to save space
   - Smooth expand/collapse animation

4. **Individual selection**
   - Each codebase has its own checkbox
   - Shows codebase icon and name
   - Hover effect for better UX

5. **Empty state**
   - Cute message when no data sources exist
   - Link to data sources page
   - Closes dialog when clicking the link

**UI Components Used**:
- `Checkbox` - For select all and individual selections
- `Button` - For expand/collapse and "Add Data Sources"
- `Link` - For navigation to data sources page
- Icons: `ChevronDown`, `ChevronRight`, `Code`, `ExternalLink`, `Loader2`

---

## Technical Implementation

### State Management

```typescript
// Data sources state
const [codebases, setCodebases] = useState<Codebase[]>([]);
const [isLoadingCodebases, setIsLoadingCodebases] = useState(false);
const [selectedCodebases, setSelectedCodebases] = useState<Set<string>>(new Set());
const [isCodebasesExpanded, setIsCodebasesExpanded] = useState(false);
```

### Loading Codebases

```typescript
useEffect(() => {
  if (open) {
    loadCodebases();
  }
}, [open]);

const loadCodebases = async () => {
  setIsLoadingCodebases(true);
  try {
    const data = await getCodebases();
    setCodebases(data);
    // Select all by default
    setSelectedCodebases(new Set(data.map(cb => cb.object_id)));
  } catch (err) {
    console.error("Failed to load codebases:", err);
  } finally {
    setIsLoadingCodebases(false);
  }
};
```

### Toggle Functions

```typescript
const toggleAllCodebases = (checked: boolean) => {
  if (checked) {
    setSelectedCodebases(new Set(codebases.map(cb => cb.object_id)));
  } else {
    setSelectedCodebases(new Set());
  }
};

const toggleCodebase = (codebaseId: string, checked: boolean) => {
  const newSelected = new Set(selectedCodebases);
  if (checked) {
    newSelected.add(codebaseId);
  } else {
    newSelected.delete(codebaseId);
  }
  setSelectedCodebases(newSelected);
};
```

### Computed Values

```typescript
const allCodebasesSelected = codebases.length > 0 && selectedCodebases.size === codebases.length;
```

---

## UI States

### 1. Loading State
Shows spinner while fetching codebases:
```
🔄 Loading data sources...
```

### 2. Empty State
Shows when no codebases exist:
```
┌─────────────────────────────────────┐
│  There's nothing here... 👀         │
│                                     │
│  We could just stare at each other, │
│  but my guess is you probably just  │
│  want to add some data sources      │
│  instead 😉                         │
│                                     │
│  [🔗 Add Data Sources]              │
└─────────────────────────────────────┘
```

### 3. Collapsed State (Default)
Shows select all checkbox with count:
```
┌─────────────────────────────────────┐
│ ☑ Codebases (5/5 selected)      ▶  │
└─────────────────────────────────────┘
```

### 4. Expanded State
Shows all individual codebases:
```
┌─────────────────────────────────────┐
│ ☑ Codebases (3/5 selected)      ▼  │
│   ☑ 💻 patient-portal-api           │
│   ☑ 💻 medical-records-db           │
│   ☐ 💻 billing-service              │
│   ☑ 💻 auth-service                 │
│   ☐ 💻 notification-service         │
└─────────────────────────────────────┘
```

---

## User Experience Improvements

### Before
1. ❌ Status shown twice on project cards (redundant)
2. ❌ No way to select data sources when creating project
3. ❌ Had to manually add data sources after project creation

### After
1. ✅ Clean card design with status shown once
2. ✅ Select data sources during project creation
3. ✅ All data sources selected by default (smart defaults)
4. ✅ Easy to expand and customize selection
5. ✅ Helpful empty state with link to add data sources
6. ✅ Cute, friendly messaging

---

### 3. Added Data Source Selector to Edit Project Dialog ✅

**Feature**: When editing a project, users can now select which data sources (codebases) to associate with the project.

**Same behavior as Create Dialog**:
- ✅ All codebases are selected by default
- ✅ "Select All" checkbox to toggle all at once
- ✅ Expandable list to view and select individual codebases
- ✅ Shows count of selected codebases
- ✅ Same empty state with cute message and link

**Files Modified**:
- `app/projects/components/edit-project-dialog.tsx`

**Key Difference from Create Dialog**:
- Uses `edit-` prefix for all IDs to avoid conflicts when both dialogs are mounted

---

### 4. Removed Compliance Score Field from Edit Dialog ✅

**Rationale**: Compliance scores should be calculated automatically by the system, not manually edited by users.

**Change**: Removed the compliance score input field from the edit project dialog.

**Files Modified**:
- `app/projects/components/edit-project-dialog.tsx`

**Code Removed**:
```typescript
// REMOVED:
<div className="space-y-2">
  <Label htmlFor="edit-compliance-score">
    Compliance Score (0-100)
  </Label>
  <Input
    id="edit-compliance-score"
    type="number"
    min="0"
    max="100"
    step="0.1"
    placeholder="0"
    value={complianceScore}
    onChange={(e) => setComplianceScore(e.target.value)}
    disabled={isSubmitting}
  />
</div>
```

**Also Removed**:
- `complianceScore` state variable
- Compliance score validation in `handleSubmit`
- `compliance_score` from `onUpdateProject` interface

**Result**: Cleaner edit dialog focused on user-editable fields only.

---

## Future Enhancements

The data source selection is currently **visual only** - the selected codebases are not yet saved to the backend. To fully implement this feature:

1. **Backend**: Create `ProjectDataSource` model and endpoints
2. **Frontend**: Send selected codebase IDs when creating/updating project
3. **Display**: Show linked data sources on project detail page
4. **Management**: Allow adding/removing data sources after creation

For now, this provides the UI foundation and user experience for data source selection.

---

## Testing Checklist

### Project Cards
- [x] Project cards show status badge only once
- [x] No duplicate status display

### Create Project Dialog
- [x] Create dialog loads codebases on open
- [x] All codebases selected by default
- [x] Select all checkbox works
- [x] Individual checkbox selection works
- [x] Expand/collapse works smoothly
- [x] Empty state shows when no codebases
- [x] "Add Data Sources" link navigates correctly
- [x] Loading state shows while fetching
- [x] Form resets when dialog closes
- [x] Null safety for undefined codebases

### Edit Project Dialog
- [x] Edit dialog loads codebases on open
- [x] All codebases selected by default
- [x] Select all checkbox works (with edit- prefix)
- [x] Individual checkbox selection works
- [x] Expand/collapse works smoothly
- [x] Empty state shows when no codebases
- [x] Compliance score field removed
- [x] No compliance score validation
- [x] Form resets when dialog closes
- [x] Null safety for undefined codebases

### General
- [x] No TypeScript errors
- [x] No console errors
- [x] Responsive design works on mobile

---

## Screenshots

### Project Card (Before)
```
┌─────────────────────────────┐
│ HIPAA Compliance  [Active]  │
│ Healthcare project...       │
│                             │
│ Compliance Score      85%   │
│ ████████████░░░░░░░░        │
│                             │
│ Status: active  ← DUPLICATE │
│                             │
│ 💻 0  📄 0  👥 0            │
└─────────────────────────────┘
```

### Project Card (After)
```
┌─────────────────────────────┐
│ HIPAA Compliance  [Active]  │
│ Healthcare project...       │
│                             │
│ Compliance Score      85%   │
│ ████████████░░░░░░░░        │
│                             │
│ 💻 0  📄 0  👥 0            │
└─────────────────────────────┘
```

### Create Dialog with Data Sources
```
┌─────────────────────────────────────┐
│ Create New Project                  │
│                                     │
│ Name: *                             │
│ [HIPAA Compliance Project_____]    │
│                                     │
│ Description:                        │
│ [Healthcare compliance...____]     │
│                                     │
│ Status:                             │
│ [Active ▼]                          │
│                                     │
│ ─────────────────────────────────  │
│                                     │
│ Data Sources (Optional)             │
│ ┌─────────────────────────────┐   │
│ │ ☑ Codebases (5/5 selected) ▼│   │
│ │   ☑ 💻 patient-portal-api   │   │
│ │   ☑ 💻 medical-records-db   │   │
│ │   ☑ 💻 billing-service      │   │
│ │   ☑ 💻 auth-service         │   │
│ │   ☑ 💻 notification-service │   │
│ └─────────────────────────────┘   │
│                                     │
│         [Cancel] [Create Project]  │
└─────────────────────────────────────┘
```

