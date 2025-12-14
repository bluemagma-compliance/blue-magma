# Project Templates Frontend - Implementation Summary

**Version:** 1.0  
**Date:** 2025-10-29  
**Status:** Ready for Implementation

---

## Quick Overview

Implement frontend support for Project Templates. Users can create projects from pre-built templates (HIPAA, SOX) that automatically include documentation structure and policy templates. This is a 6-phase implementation with clear dependencies.

---

## What Gets Built

### User-Facing Features
1. **Template Browser** - Browse available templates with search/filter
2. **Template Preview** - See what's included before creating project
3. **Enhanced Project Creation** - Optional template selection during project creation
4. **Policies Tab** - New tab in project detail to manage policies
5. **Policy Editor** - Create/edit policies with markdown support
6. **Policy Viewer** - Read-only display of policy content

### Backend Integration
- 9 new server actions (3 for templates, 6 for policies)
- All endpoints already implemented in backend
- No backend changes needed

---

## Implementation Phases

| Phase | Focus | Files | Effort |
|-------|-------|-------|--------|
| 1 | Types & API | types.ts, actions.ts | 2-3 hrs |
| 2 | Template UI | template-browser.tsx, template-preview-modal.tsx | 3-4 hrs |
| 3 | Project Creation | create-project-dialog.tsx, page.tsx | 2-3 hrs |
| 4 | Policies Tab | policies-tab.tsx, policy-editor.tsx, [projectId]/page.tsx | 4-5 hrs |
| 5 | Policy Features | policy-viewer.tsx, bulk ops | 2-3 hrs |
| 6 | Polish | Error handling, loading states, empty states | 2-3 hrs |

**Total Estimated Effort:** 15-21 hours

---

## Files Summary

### New Files (5)
1. `template-browser.tsx` - Template discovery UI
2. `template-preview-modal.tsx` - Template details preview
3. `policies-tab.tsx` - Main policies management interface
4. `policy-editor.tsx` - Create/edit policies modal
5. `policy-viewer.tsx` - Read-only policy display

### Modified Files (5)
1. `types.ts` - Add ProjectTemplate, PolicyTemplate types
2. `actions.ts` - Add 9 new server actions
3. `create-project-dialog.tsx` - Add template selection
4. `page.tsx` - Pass template_id to creation
5. `[projectId]/page.tsx` - Add Policies tab

---

## Key Design Decisions

### 1. Template Selection is Optional
- Users can still create projects without templates
- Template selection is a toggle in create dialog
- Supports both flows seamlessly

### 2. Policies are Project-Scoped
- Each project has independent policy instances
- Editing a policy doesn't affect template or other projects
- Policies can be created/edited/deleted freely

### 3. Markdown-Based Content
- All policy content is markdown
- Supports preview before saving
- Consistent with documentation system

### 4. Modal-Based Editing
- Policy editor is modal, not separate page
- Keeps user in project context
- Faster workflow

### 5. Reuse Existing Patterns
- Follow existing component patterns (tabs, dialogs, forms)
- Use existing UI components (Card, Button, Input, etc.)
- Consistent with documentation tab implementation

---

## API Contracts

### Template Endpoints (Public)
```
GET /api/v1/project-template
GET /api/v1/project-template/{id}
```

### Policy Endpoints (Org-Scoped)
```
GET    /api/v1/org/{orgId}/project/{projectId}/policy-template
GET    /api/v1/org/{orgId}/project/{projectId}/policy-template/{policyId}
POST   /api/v1/org/{orgId}/project/{projectId}/policy-template
PUT    /api/v1/org/{orgId}/project/{projectId}/policy-template/{policyId}
DELETE /api/v1/org/{orgId}/project/{projectId}/policy-template/{policyId}
```

### Project Creation with Template
```
POST /api/v1/org/{orgId}/project
Body: { name, description, template_id }
```

---

## Component Dependencies

```
template-browser.tsx
  └── Calls: getProjectTemplates()
  └── Emits: onSelectTemplate(templateId)

template-preview-modal.tsx
  └── Calls: getProjectTemplateById(templateId)
  └── Emits: onUseTemplate(templateId)

create-project-dialog.tsx
  ├── Imports: template-browser, template-preview-modal
  ├── Calls: createProjectFromTemplate(data, templateId)
  └── Emits: onCreateProject()

policies-tab.tsx
  ├── Imports: policy-editor, policy-viewer
  ├── Calls: getProjectPolicies(projectId)
  └── Manages: policy list state

policy-editor.tsx
  ├── Calls: createPolicy() or updatePolicy()
  └── Emits: onSave()

policy-viewer.tsx
  └── Displays: PolicyTemplate content
```

---

## Success Criteria

✅ **Phase 1**: Types defined, server actions created  
✅ **Phase 2**: Template browser works, preview shows correct data  
✅ **Phase 3**: Project creation with template works end-to-end  
✅ **Phase 4**: Policies tab displays, CRUD operations work  
✅ **Phase 5**: Policy features (viewer, bulk ops) work  
✅ **Phase 6**: All error states handled, UX polished  

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| API contract mismatch | Verify backend API docs before implementation |
| Type mismatches | Use strict TypeScript, test with real API |
| Performance issues | Implement pagination for large policy lists |
| UX confusion | Clear labeling, helpful empty states |
| Data loss | Confirmation dialogs for delete operations |

---

## Next Steps

1. **Review** this plan with team
2. **Approve** implementation approach
3. **Start Phase 1** - Type definitions & server actions
4. **Iterate** through phases with testing
5. **Deploy** when all phases complete

---

## References

- Backend API Documentation: `docs/PROJECT_TEMPLATES_API.md` (backend repo)
- Template Structure: `templates/hipaa_project_template.json` (backend repo)
- Existing Documentation Tab: `components/documentation-tab.tsx`
- Existing Project Creation: `components/create-project-dialog.tsx`

---

## Questions to Clarify

1. Should template selection be in a separate step or inline in create dialog?
2. Should policies be editable inline or only in modal?
3. Should we support bulk policy operations in Phase 5?
4. Should policies have version history?
5. Should we add policy templates to Knowledge Base section?

---

**Plan Created:** 2025-10-29  
**Ready for Implementation:** Yes  
**Estimated Timeline:** 3-4 weeks (with testing)

