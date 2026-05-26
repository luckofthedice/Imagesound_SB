/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/task', 'N/redirect', 'N/log'], (task, redirect, log) => {
    const onRequest = (scriptContext) => {
        // 1. Get the PO ID from the URL
        const poId = scriptContext.request.parameters.custparam_poid;
        
        // LOG 1: Check if the Suitelet even sees the PO ID
        log.audit('Suitelet Step 1', 'PO ID received from URL: ' + poId);

        if (!poId) {
            log.error('Error', 'No PO ID found in request parameters');
            return scriptContext.response.write('Error: PO ID is missing.');
        }

        try {
            // 2. Create the background task
           const mrTask = task.create({
    taskType: task.TaskType.MAP_REDUCE,
    scriptId: 'customscript_mr_close_po',
    deploymentId: 'customdeploy1', // Ensure this matches your ID exactly
    params: {
        'custscript_po_to_close': poId
    }
});

            // 3. Submit the task
            const taskId = mrTask.submit();
            
            // LOG 2: Confirm the task was actually queued
            log.audit('Suitelet Step 2', 'Map/Reduce Task submitted. Task ID: ' + taskId);

            scriptContext.response.write(`
                <html><body style="font-family:sans-serif; text-align:center; padding:50px;">
                    <h2 style="color: #0070d2;">Request Received</h2>
                    <p>Processing PO #${poId} in the background...</p>
                    <p>Returning you to the record in 5 seconds.</p>
                    <script>
                        setTimeout(function(){ 
                            window.location.href='/app/accounting/transactions/purchord.nl?id=${poId}'; 
                        }, 5000);
                    </script>
                </body></html>
            `);

        } catch (e) {
            log.error('Suitelet Step 3: FAILED', e.message);
            scriptContext.response.write('Task Submission Failed: ' + e.message);
        }
    };
    return { onRequest };
});