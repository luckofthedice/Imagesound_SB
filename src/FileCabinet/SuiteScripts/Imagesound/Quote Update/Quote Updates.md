# Quote Update Scripts

This folder contains five scripts that together provide three quote-management popup workflows on the NetSuite Quote (Estimate) record.

---

## Script Overview

| File | Script Type | Script ID | Deployment ID |
|---|---|---|---|
| `quote_update_ue.js` | User Event | `customscript_update_quote_ue` | `customdeploy_update_quote_ue` |
| `quote_update_cs.js` | Client Script | — | — |
| `quote_update_sl.js` | Suitelet | `customscript_quote_update_sl` | `customdeploy_quote_update_sl` |
| `quote_item_update_sl.js` | Suitelet | `customscript_quote_item_update_sl` | `customdeploy_quote_item_update_sl` |
| `quote_tidy_sl.js` | Suitelet | `customscript_quote_tidy_sl` | `customdeploy_quote_tidy_sl` |

---

## Individual Script Descriptions

### `quote_update_ue.js` — User Event Script

**Trigger:** `beforeLoad` on the Quote (Estimate) record, VIEW mode only.

This script is the entry point for the entire workflow. When a user opens a Quote record in view mode it:

1. Attaches `quote_update_cs.js` as the client-side script for the form.
2. Adds three custom buttons to the form toolbar:

| Button Label | Client Function Called | Opens |
|---|---|---|
| **Update Quote** | `updateQuote()` | `quote_update_sl.js` popup |
| **Update Quote Items** | `updateQuoteItems()` | `quote_item_update_sl.js` popup |
| **Remove Closed Zone Lines** | `tidyQuote()` | `quote_tidy_sl.js` popup |

Additional buttons can be added here in the future by defining more handler functions in `quote_update_cs.js` and wiring them up in this script.

---

### `quote_update_cs.js` — Client Script

**Deployed via:** `quote_update_ue.js` (on the Quote form) and directly on the serverWidget forms rendered by `quote_item_update_sl.js` and `quote_tidy_sl.js`.

This script serves two distinct roles:

#### 1. Button handlers (on the Quote form)

Each function resolves the relevant Suitelet URL using `N/url`, passing the current quote's internal ID as a `quoteId` parameter, then opens the result in a small browser popup:

- **`updateQuote()`** — opens `quote_update_sl.js` in a popup window.
- **`updateQuoteItems()`** — opens `quote_item_update_sl.js` in a popup window.
- **`tidyQuote()`** — opens `quote_tidy_sl.js` in a popup window.

#### 2. `fieldChanged` — date auto-population (on popup forms)

When the `custpage_end_date` field changes on any serverWidget popup form, this handler automatically sets `custpage_start_date` to the following day. This prevents the user from having to manually calculate the next-day start date.

---

### `quote_update_sl.js` — Suitelet ("Update Quote")

**Purpose:** Allows a user to set a contract end date on the current quote and simultaneously create a new quote copy with updated rates, frequencies, and music content types.

#### GET — Render the form

1. Loads the Quote record.
2. Iterates all item lines and de-duplicates them by the composite key `item + rate + frequency + musicContentType`.
3. Renders a **custom HTML form** (not a serverWidget form) containing:
   - An **End Date** field (for the current/old quote).
   - A **Start Date** field (for the new quote) — auto-populated via inline JavaScript when End Date changes.
   - A table with one row per unique line combination, showing: item name, current rate, an editable new-rate field, a frequency dropdown, and a music content type dropdown.
   - Hidden fields carrying the original values of each line for key-matching during POST.

#### POST — Process the submission

1. Reads the submitted end date, start date, and per-line new values.
2. Builds a map of `originalKey → { newRate, frequency, musConan }`.
3. **Updates the original quote:**
   - Sets `custbody_nb2_quote_cancel_date` (body-level cancel date).
   - Sets `custcol_nb2_contract_enddate` on every line.
   - Saves the record.
4. **Creates a new quote** by copying the saved original:
   - Clears the inherited `custbody_nb2_quote_cancel_date`.
   - For each line, looks up the update map by key and applies any changed rate, frequency, or music content type.
   - Clears the inherited `custcol_nb2_contract_enddate` on each line.
   - Sets `custcol_nb2_contract_startdate` on each line.
   - Sets `custbody_original_quote` on the new quote to the old quote's ID.
   - Saves the new quote.
5. Links the two records by writing the new quote's ID into `custbody_updated_quote` on the old quote.
6. Returns a **success HTML page** that redirects the opener window to the old quote record and closes the popup after 1.5 seconds.

---

### `quote_item_update_sl.js` — Suitelet ("Update Quote Items")

**Purpose:** Similar to `quote_update_sl.js` but uses native NetSuite **serverWidget** UI and additionally allows the user to **change the item itself** on each line (not just the rate/frequency/music content).

#### GET — Render the serverWidget form

1. Loads the Quote record and de-duplicates lines by the same `item + rate + frequency + musicContentType` composite key.
2. Builds a serverWidget form containing:
   - A hidden `custpage_quote_id` field.
   - Mandatory **End Date** and **Start Date** fields (auto-populated by `fieldChanged` in `quote_update_cs.js`).
   - A sublist (`custpage_lines`) with one row per unique combination:

| Column | Type | Purpose |
|---|---|---|
| `custpage_item` | SELECT (item list) | Editable — user can choose a replacement item |
| `custpage_orig_item_label` | TEXT (disabled) | Read-only display of original item name |
| `custpage_orig_item` | TEXT (hidden) | Original item ID for POST key matching |
| `custpage_current_rate` | TEXT (disabled) | Read-only current rate |
| `custpage_new_rate` | FLOAT | Editable new rate |
| `custpage_orig_rate` | TEXT (hidden) | Original rate for POST key matching |
| `custpage_frequency` | SELECT (`customrecordzab_charge_schedules`) | Editable frequency |
| `custpage_orig_frequency` | TEXT (hidden) | Original frequency for POST key matching |
| `custpage_mus_conan` | SELECT (`customlist_nb2_mus_con_lis`) | Editable music content type |
| `custpage_orig_mus_conan` | TEXT (hidden) | Original music content for POST key matching |

#### POST — Process the submission

1. Reads submitted values from the sublist using `context.request.getSublistValue`.
2. Builds an update map of `originalKey → { newItem, newRate, newFrequency, newMusicContent }`.
3. **Updates the original quote:** sets `custcol_nb2_contract_enddate` on all lines and saves.
4. **Creates a new quote** by copying the original:
   - Clears `custbody_nb2_quote_cancel_date`.
   - For each line, applies any changed item, rate, frequency, and music content type.
   - Clears the inherited end date and sets the new start date on every line.
   - Sets `custbody_original_quote` and saves.
5. Links both records via `custbody_updated_quote` and `custbody_nb2_quote_cancel_date` on the old quote.
6. Returns a success HTML page that refreshes the opener and closes the popup.

---

### `quote_tidy_sl.js` — Suitelet ("Remove Closed Zone Lines")

**Purpose:** Identifies quote lines that belong to zones with status **Lost Customer** (status code `16`) and removes those lines when creating a new quote copy.

#### GET — Render the serverWidget form

1. Loads the Quote record.
2. Runs a saved search against the `estimate` record type, filtered to lines where the linked `custcol_nb2_zone` has `status = 16` (Lost Customer), to collect the internal IDs of all closed zones on the quote.
3. Iterates the quote lines and collects those whose `custcol_nb2_zone` value matches a closed zone ID.
4. Builds a serverWidget form containing:
   - Hidden `custpage_quote_id`.
   - Mandatory **End Date** and **Start Date** fields.
   - A read-only sublist (`custpage_lines_to_remove`) showing the lines that **will be removed**: line number, item name, zone name, rate, and quantity. This gives the user a preview before confirming.
   - A **Process** submit button and a **Cancel** button.

#### POST — Process the submission

1. Re-runs `getClosedZoneIds` to get a fresh list of closed zone IDs.
2. **Updates the original quote:**
   - Sets `custbody_nb2_quote_cancel_date` (only if not already set).
   - Sets `custcol_nb2_contract_enddate` on each line (only if not already set).
   - Saves the record.
3. **Creates a new quote** by copying the original:
   - Clears `custbody_nb2_quote_cancel_date`.
   - Removes lines associated with closed zones **in reverse index order** (to keep line indices stable during removal).
   - Sets `custcol_nb2_contract_startdate` on all remaining lines and clears their inherited end dates.
   - Sets `custbody_original_quote` and saves.
4. Links the new quote ID back to the old quote via `custbody_updated_quote`.
5. Returns a success page that redirects the opener to the original quote record and closes the popup.

---

## How the Scripts Interact

```
Quote Record (VIEW mode)
        │
        │  beforeLoad
        ▼
quote_update_ue.js ──── attaches ──► quote_update_cs.js (client script)
        │
        │  adds 3 buttons
        ▼
┌─────────────────────────────────────────────────────────┐
│  [Update Quote]  [Update Quote Items]  [Remove Closed]  │
└────────┬──────────────────┬──────────────────┬──────────┘
         │                  │                  │
  updateQuote()    updateQuoteItems()      tidyQuote()
  (CS function)    (CS function)           (CS function)
         │                  │                  │
         ▼                  ▼                  ▼
  quote_update_sl    quote_item_update_sl   quote_tidy_sl
  (popup window)     (popup window)         (popup window)
         │                  │                  │
         └──────────────────┴──────────────────┘
                            │
              All three Suitelets share the same
              outcome pattern on POST:
                1. Set end date on original quote
                2. Copy quote → new quote
                3. Apply changes to new quote lines
                4. Link old ↔ new via custom body fields
                5. Close popup, refresh original quote
```

### Shared fields used for quote linking

| Field ID | Record | Purpose |
|---|---|---|
| `custbody_nb2_quote_cancel_date` | Old quote body | Contract cancellation / end date |
| `custcol_nb2_contract_enddate` | Old quote lines | Per-line end date |
| `custcol_nb2_contract_startdate` | New quote lines | Per-line start date |
| `custbody_original_quote` | New quote body | Points back to the old quote |
| `custbody_updated_quote` | Old quote body | Points forward to the new quote |

### Key differences between the three Suitelets

| Feature | `quote_update_sl` | `quote_item_update_sl` | `quote_tidy_sl` |
|---|---|---|---|
| UI technology | Custom HTML | serverWidget | serverWidget |
| Change rates | Yes | Yes | No |
| Change frequency | Yes | Yes | No |
| Change music content | Yes | Yes | No |
| Change item itself | No | Yes | No |
| Remove lines | No | No | Yes (closed zones only) |
| Line selection | All unique combinations | All unique combinations | Closed-zone lines only |
