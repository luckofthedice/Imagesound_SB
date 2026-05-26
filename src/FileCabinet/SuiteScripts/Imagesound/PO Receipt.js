/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/error', 'N/runtime', 'N/redirect'], (record, error, runtime, redirect) => {
    
    const onRequest = (scriptContext) => {
        const poId = scriptContext.request.parameters.custparam_poid;
        const currentUser = runtime.getCurrentUser();
        
        try {
            // Transform PO to Item Receipt
            const objRecord = record.transform({
                fromType: record.Type.PURCHASE_ORDER,
                fromId: poId,
                toType: record.Type.ITEM_RECEIPT,
                isDynamic: true
            });

            // Audit Trail: Stamp who actually clicked the button
            objRecord.setValue({
                fieldId: 'memo',
                value: `Service received via Employee Center by: ${currentUser.name}`
            });

            const receiptId = objRecord.save();
            log.audit('Receipt Created', `ID: ${receiptId} for PO: ${poId}`);

            // Redirect back to the Purchase Order with a confirmation message
            redirect.toRecord({
                type: record.Type.PURCHASE_ORDER,
                id: poId
            });

        } catch (e) {
            log.error('Receipt Error', e);
            scriptContext.response.write(`Error creating receipt: ${e.message}`);
        }
    };

    return {
        onRequest: onRequest
    };
});