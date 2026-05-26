/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @Description Final production version for Imagesound Ltd. Replicates Mobile FSM logic.
 */

define(['N/record', 'N/format', 'N/log', 'N/search'], (record, format, log, search) => {

    const TARGET_TASK_TYPES = ['7', '3']; 
    const STATUS_COMPLETED = 'COMPLETE';
    const LOCATION_CHESTERFIELD = '3'; 
    const DEFAULT_SERVICE_ITEM = '9363'; 
    const FIELD_SERVICE_FORM = '565'; 

    const afterSubmit = (scriptContext) => {
        if (scriptContext.type !== scriptContext.UserEventType.EDIT && 
            scriptContext.type !== scriptContext.UserEventType.CREATE) return;

        const newRec = scriptContext.newRecord;
        const oldRec = scriptContext.oldRecord;

        try {
            const taskType = newRec.getValue({ fieldId: 'custevent_nx_task_type' });
            if (!TARGET_TASK_TYPES.includes(String(taskType))) return;

            const newStatus = newRec.getValue({ fieldId: 'status' });
            const oldStatus = oldRec ? oldRec.getValue({ fieldId: 'status' }) : null;

            if (newStatus === STATUS_COMPLETED && oldStatus !== STATUS_COMPLETED) {
                createTimeEntry(newRec);
            }
        } catch (e) {
            log.error('Validation Error', `Task ID: ${newRec.id} | ${e.message}`);
        }
    };

    function createTimeEntry(taskRec) {
        try {
            const engineerId = taskRec.getValue({ fieldId: 'assigned' });
            const jobId = taskRec.getValue({ fieldId: 'company' }); 
            const startTime = taskRec.getValue({ fieldId: 'custevent_nx_task_start' });
            const endTime = taskRec.getValue({ fieldId: 'custevent_nx_task_end' });

            const projectLookup = search.lookupFields({
                type: search.Type.ENTITY,
                id: jobId,
                columns: ['subsidiary']
            });
            const targetSubsidiary = projectLookup.subsidiary?.[0]?.value;

            // Use Standard Mode (isDynamic: false) to prevent the "static sublist" error
            const timeRec = record.create({ type: record.Type.TIME_BILL, isDynamic: false });

            // 1. Force Form and Header Context
            timeRec.setValue({ fieldId: 'customform', value: FIELD_SERVICE_FORM });
            timeRec.setValue({ fieldId: 'subsidiary', value: targetSubsidiary });
            timeRec.setValue({ fieldId: 'employee', value: engineerId });
            timeRec.setValue({ 
                fieldId: 'trandate', 
                value: format.parse({ value: endTime, type: format.Type.DATE }) 
            });

            // 2. Project & Item
            timeRec.setValue({ fieldId: 'customer', value: jobId });
            timeRec.setValue({ fieldId: 'serviceitem', value: DEFAULT_SERVICE_ITEM });

            // 3. SET THE CUSTOM FSM FIELDS (Mapping your identified IDs)
            // Even though these are 'custcol', they often function as body fields on time bills
            timeRec.setValue({ fieldId: 'custcol_nx_task', value: taskRec.id });
            
            const uniqueKey = 'IDEM-' + taskRec.id + '-' + new Date().getTime();
            timeRec.setValue({ fieldId: 'custcol_nx_idempotency_key', value: uniqueKey });

            const assetId = taskRec.getValue({ fieldId: 'custevent_nx_asset' });
            if (assetId) {
                timeRec.setValue({ fieldId: 'custcol_nx_asset', value: assetId });
            }

            // 4. Native Task Link (The 'blocker' field)
            // We set it last and keep it in a safety try-catch
            try {
                timeRec.setValue({ fieldId: 'casetaskevent', value: taskRec.id });
            } catch (e) {
                log.debug('Link Note', 'Native link blocked; using custcol_nx_task only.');
            }

            // 5. Final Details
            timeRec.setValue({ fieldId: 'location', value: LOCATION_CHESTERFIELD });
            const duration = (new Date(endTime) - new Date(startTime)) / 3600000;
            timeRec.setValue({ fieldId: 'hours', value: duration.toFixed(2) });
            timeRec.setValue({ fieldId: 'isbillable', value: true });

            const timeId = timeRec.save({ ignoreMandatoryFields: true });
            log.audit('Success', `Time Bill ${timeId} created for Task ${taskRec.id}`);

        } catch (e) {
            log.error('Creation Failed', `Task ID: ${taskRec.id} | Error: ${e.message}`);
        }
    }

    return { afterSubmit };
});