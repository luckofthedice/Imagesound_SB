/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/runtime', 'N/log'], (record, runtime, log) => {

    const getInputData = () => {
        const poId = runtime.getCurrentScript().getParameter({ name: 'custscript_po_to_close' });
        log.audit('MR Waking Up', 'Targeting PO ID: ' + poId);
        return poId ? [poId] : [];
    };

    const map = (context) => {
        const poId = context.value;
        try {
            log.audit('Step 1: Loading Record', 'PO ID: ' + poId);
            
            // Load the record in standard mode to bypass UI locks
            const poRec = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: poId,
                isDynamic: false
            });

            // Step 2: Manually close every line
            const lineCount = poRec.getLineCount({ sublistId: 'item' });
            log.debug('Step 2: Processing Lines', 'Total lines to close: ' + lineCount);

            for (let i = 0; i < lineCount; i++) {
                poRec.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'isclosed',
                    line: i,
                    value: true
                });
            }

            // Step 3: Force Save
            // ignoreMandatoryFields: true is vital for Sandbox testing
            const savedId = poRec.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            log.audit('Step 3: SUCCESS', 'PO ' + savedId + ' saved. Check System Notes now.');

        } catch (e) {
            // This will finally tell us IF a different script is blocking the save
            log.error('CRITICAL SAVE ERROR', 'PO ' + poId + ' failed. Reason: ' + e.message);
        }
    };

    return { getInputData, map };
});