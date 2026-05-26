/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/email', 'N/render', 'N/runtime', 'N/log'], (email, render, runtime, log) => {

    const afterSubmit = (scriptContext) => {
        if (scriptContext.type !== scriptContext.UserEventType.EDIT) return;

        const newRec = scriptContext.newRecord;
        const oldRec = scriptContext.oldRecord;

        const SERVICE_TYPE_ID = '3';
        const OPERATIONS_ID = '446';
        const TEMPLATE_ID = 46;

        // 1. Validate Task Type
        const taskType = newRec.getValue({ fieldId: 'custevent_nx_task_type' });
        if (taskType != SERVICE_TYPE_ID) return;

        // 2. Logic: Assignment Change
        const oldAssignee = oldRec.getValue({ fieldId: 'assigned' });
        const newAssignee = newRec.getValue({ fieldId: 'assigned' });

        // Criteria: Changed, Not Ops, Not Empty
        if (newAssignee != oldAssignee && newAssignee != OPERATIONS_ID && newAssignee) {
            try {
                const taskTitle = newRec.getValue({ fieldId: 'title' }) || "Service Task";
                
                // Use current user (Admin) as author to ensure permissions exist
                const currentUserId = runtime.getCurrentUser().id;

                // 3. Load Template
                const emailMerge = render.mergeEmail({
                    templateId: TEMPLATE_ID,
                    entity: null,
                    recipient: null
                });

                let finalSubject = emailMerge.subject.replace(/\[TASK_TITLE\]/g, taskTitle);
                let finalBody = emailMerge.body.replace(/\[TASK_TITLE\]/g, taskTitle);

                // 4. Send
                email.send({
                    author: currentUserId, 
                    recipients: newAssignee,
                    subject: finalSubject,
                    body: finalBody,
                    relatedRecords: {
                        taskId: newRec.id
                    }
                });

                log.audit('Success', `RAMS Sent from ${currentUserId} to ${newAssignee}`);

            } catch (e) {
                // If this fails, it's likely a domain verification issue
                log.error('Detailed Send Failure', `Error: ${e.name} | Msg: ${e.message}`);
            }
        }
    };

    return { afterSubmit };
});