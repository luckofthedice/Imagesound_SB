/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/log', 'N/format'], (record, log, format) => {

    const onRequest = (scriptContext) => {
        log.debug('suitelet', scriptContext.request.method);
        if (scriptContext.request.method !== 'POST') return;

        const payload = JSON.parse(scriptContext.request.body);
        const { zsId, spzId, invoicedToDate, line } = payload;

        log.debug('suitelet payload', payload);

        const toDate = (val) => val instanceof Date ? val : format.parse({ type: format.Type.DATE, value: val });

        const startDate = new Date(toDate(line.endDate));
        startDate.setDate(startDate.getDate() + 1);

        const zsiRec = record.create({ type: 'customrecordzab_subscription_item', isDynamic: true });

        zsiRec.setValue({ fieldId: 'custrecordzab_si_subscription',       value: zsId });
        zsiRec.setValue({ fieldId: 'custrecord_nb2_si_spz',               value: spzId });
        zsiRec.setValue({ fieldId: 'custrecordzab_si_item',               value: line.item });
        zsiRec.setValue({ fieldId: 'name',                                value: line.itemName });
        zsiRec.setValue({ fieldId: 'custrecordzab_si_item_description',   value: line.description });
        zsiRec.setValue({ fieldId: 'custrecordzab_si_rate_type',          value: 1 });
        zsiRec.setValue({ fieldId: 'custrecordzab_si_start_date',         value: startDate });
        zsiRec.setValue({ fieldId: 'custrecordzab_si_end_date',           value: toDate(invoicedToDate) });
        zsiRec.setValue({ fieldId: 'custrecordzab_si_quantity',           value: 0 - line.zonesCount });
        zsiRec.setValue({ fieldId: 'custrecordzab_si_rate',               value: line.rate });
        zsiRec.setValue({ fieldId: 'custrecordzab_si_charge_schedule',    value: line.chargeSchedule });
        zsiRec.setValue({ fieldId: 'custrecordzab_si_proration_type',     value: 1 });

        const zsiId = zsiRec.save();
        log.debug('zsiRec saved', { zsiId });

        scriptContext.response.write(JSON.stringify({ success: true, zsiId }));
    };

    return { onRequest };
});