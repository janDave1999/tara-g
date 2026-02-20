# Error Log

> Track errors found during development and testing.
> Format: Date | Error | Cause | Fix | Status

---

## Trip Creation - Map Picker Feature

| Date | Error | Cause | Fix | Status |
|------|-------|-------|-----|--------|
| 2026-02-19 | `Uncaught SyntaxError: Cannot use import statement outside a module` at create:9030, 9347, 9664 | Used ES module `import` inside regular `<script>` tag in MapPickerModal.astro. Astro bundles scripts differently. | Changed to global script loading via `<script src="...">` and pure JavaScript | **FIXED** |
| 2026-02-19 | `TypeError: Cannot read properties of undefined (reading 'classList')` in flatpickr | Date picker initialization runs before DOM elements exist or flatpickr instance not properly stored | Added null check for instance.calendarContainer in onReady callback | **FIXED** |
| 2026-02-19 | `TypeError: fpInstance.set is not a function` at updateDateConstraints | flatpickr instance not properly initialized or reference lost | Added guards in setMinDate/setMaxDate to verify fpInstance and set method exist | **FIXED** |

---

## User Account Creation

| Date | Error | Cause | Fix | Status |
|------|-------|-------|-----|--------|
| 2026-02-20 | `stack depth limit exceeded` on user registration | Infinite recursion: trigger_user_info_completion calls update_profile_completion() which UPDATEs user_information, triggering itself in an endless loop | Created migration 022 to drop the recursive trigger on user_information | **FIXED** |

---

## Notes

- **MapPickerModal.astro**: Rewrote completely using pure JavaScript (no TypeScript) to avoid bundling issues with Astro
- **Flatpickr errors**: These appear to be pre-existing issues in DatePicker.astro
- **User registration**: Migration 022 fixes the infinite recursion in profile completion trigger

---

## Other Errors (To Be Added)

...

---

*Last updated: 2026-02-20*
*Updated: Fixed MapPickerModal import error*
*Updated: Fixed DatePicker flatpickr errors*
*Updated: Fixed user registration infinite recursion*
