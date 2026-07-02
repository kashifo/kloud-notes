# Note Editor Merge Plan

Goal: keep `/` and `/[code]` as separate routes, but merge duplicated note editor behavior into one shared client component.

## Current Problem

`src/app/page.tsx` and `src/app/[code]/NotePageClient.tsx` both implement large parts of the same experience:

- editor layout
- header/footer
- note content state
- password dialog state
- save/update behavior
- copy-link behavior
- success/error UI
- password set/change/remove logic

This creates drift. Recent fixes had to be applied twice, and one route can easily stay broken while the other is fixed.

## Target Structure

Keep these route files:

- `src/app/page.tsx`
- `src/app/[code]/page.tsx`

Create one shared client component, for example:

- `src/components/NoteEditorClient.tsx`

The shared component should support two modes:

```ts
type NoteEditorMode = 'create' | 'edit';
```

Create mode:

```tsx
<NoteEditorClient mode="create" />
```

Edit mode:

```tsx
<NoteEditorClient mode="edit" code={code} initialNote={publicNote} />
```

## Route Responsibilities

### `/`

`src/app/page.tsx` should only render create mode.

It should not:

- inspect `window.location.pathname`
- fetch existing notes
- handle edit-mode password verification
- duplicate note-viewer behavior

### `/[code]`

`src/app/[code]/page.tsx` should keep server-side note loading and pass the note into the shared editor.

It should:

- fetch note by code using the server/service client
- hide protected content until password verification
- render `NoteEditorClient` in edit mode

## Shared Component Responsibilities

`NoteEditorClient` should own:

- content state
- loading and error state
- password state
- password dialog handling
- success dialog handling
- copy-link handling
- create note action
- update note action
- custom code input in create mode
- read-only code display in edit mode
- realtime broadcast subscription in edit mode
- remote-change reload banner in edit mode
- header/footer layout

## Save Behavior

Create mode:

- call `POST /api/notes`
- send `content`, optional `password`, optional `customCode`
- after success, navigate to `/${shortCode}` with real route navigation
- do not use `window.history.pushState`

Edit mode:

- call `PATCH /api/notes/[code]`
- send `content`
- send `password` when required for protected notes
- send `newPassword` when changing password
- send `removePassword` when removing password

## Password Behavior

The shared component should handle password behavior consistently in edit mode:

- protected note requires verification before content is visible
- password is required to update protected notes
- changing password sends both current `password` and `newPassword`
- removing password sends current `password` and `removePassword: true`
- setting first password sends `password`

## Realtime Behavior

Realtime should run only in edit mode when `code` exists.

After a successful update:

- update local note state
- broadcast `note_updated` with `updated_at`

When another client receives a newer `updated_at`:

- show reload banner
- do not auto-overwrite local unsaved text

## Cleanup Steps

1. Create `NoteEditorClient`.
2. Move shared UI and state from both current files into it.
3. Shrink `src/app/page.tsx` to create-mode rendering.
4. Replace or shrink `src/app/[code]/NotePageClient.tsx`.
5. Remove pathname-based loading from home.
6. Remove duplicate password/change/remove logic.
7. Remove duplicate header/footer/editor markup.
8. Update `PROJECT_CONTEXT.md` to document the shared editor component.

## Verification Checklist

- Create note without password.
- Create note with password.
- Create note with custom code.
- Open note by link.
- Edit note by link.
- Open same note in another browser/device and verify remote update banner.
- Unlock protected note.
- Update protected note.
- Set password on unprotected note.
- Change password on protected note.
- Remove password from protected note.
- Confirm create flow navigates to the real `/[code]` route.
