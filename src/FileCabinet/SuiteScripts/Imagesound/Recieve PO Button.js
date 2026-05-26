/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/runtime'], (runtime) => {
    
    const beforeLoad = (scriptContext) => {
        if (scriptContext.type === scriptContext.UserEventType.VIEW) {
            
            try {
                const currentUser = runtime.getCurrentUser();
                const roleId = currentUser.role; 
                const form = scriptContext.form;
                const poRecord = scriptContext.newRecord;
                const status = poRecord.getValue({ fieldId: 'status' });

                // Logic for Employee Center (ID 15)
                if (roleId === 15 && (status === 'Pending Receipt' || status === 'Partially Received'|| status === 'Approved by Supervisor/Pending Receipt')) {
                    
                    // BUTTON 1: RECEIVE
                    form.addButton({
                        id: 'custpage_admin_receive_service',
                        label: 'Receive PO',
                        functionName: `(function(){
                            const url = "/app/site/hosting/scriptlet.nl?script=customscriptims_poreceipt&deploy=1&custparam_poid=${poRecord.id}";
                            window.location.href = url;
                        })()`
                    });

                    // BUTTON 2: CLOSE
                    form.addButton({
                        id: 'custpage_admin_close_po',
                        label: 'Close PO',
                        functionName: `(function(){
                            // Replace 'customscript_close_po_sl' with the ID of your new Suitelet
                            const url = "/app/site/hosting/scriptlet.nl?script=customscript_ims_close_po&deploy=1&custparam_poid=${poRecord.id}";
                            
                           // if(confirm("Are you sure you want to close this PO? This cannot be undone.")){
                                 window.location.href = url;
                           // }
                        })()`
                    });
                }
            } catch (e) {
                log.error('Button Error', e.message);
            }
        }
    };

    return { beforeLoad: beforeLoad };
});