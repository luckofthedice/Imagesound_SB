/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 *
 * @author David Kelly
 * @version 1.0
 * @since 26/05/2026
 * @description Client script for the Quote Item Update Suitelet form.
 *              When the End Date field changes, auto-populates the Start Date
 *              (new quote) with the following day.
 */
define([], function () {

    function fieldChanged(context) {
        if (context.fieldId !== 'custpage_end_date') return;

        const rec     = context.currentRecord;
        const endDate = rec.getValue({ fieldId: 'custpage_end_date' });

        if (endDate instanceof Date && !isNaN(endDate)) {
            const nextDay = new Date(endDate);
            nextDay.setDate(nextDay.getDate() + 1);
            rec.setValue({ fieldId: 'custpage_start_date', value: nextDay });
        }
    }

    return { fieldChanged: fieldChanged };
});
