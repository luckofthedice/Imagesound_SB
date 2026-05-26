/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/ui/message'], (message) => {
    return {
        beforeLoad: (context) => {
            // Ensure we are in VIEW mode and not on a Print/Email execution
            if (context.type !== context.UserEventType.VIEW) return;

            const customerRecord = context.newRecord;
            
            // Check your specific custom field
            const isWarning = customerRecord.getValue({ 
                fieldId: 'custentity_customer_warning' 
            });

            if (isWarning === true) {
                // Get the text value of the Status field (e.g., "Customer-At Risk")
                const statusText = customerRecord.getText({ 
                    fieldId: 'custentity_warningnotes' 
                });

                context.form.addPageInitMessage({
                    type: message.Type.ERROR, // Red banner for "At Risk" visibility
                    title: 'CUSTOMER WARNING',
                    message: `${statusText}`,
                    duration: 0 
                });
            }
        }
    };
});