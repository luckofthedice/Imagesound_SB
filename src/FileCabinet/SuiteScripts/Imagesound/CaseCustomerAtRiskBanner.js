/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/ui/message', 'N/search'], (message, search) => {
    let currentMsg = null;

    const checkAtWarning = (currentRecord) => {
        const customerId = currentRecord.getValue({ fieldId: 'company' });

        if (customerId) {
            const lookup = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: customerId,
                columns: ['custentity_customer_warning', 'custentity_warningnotes']
            });

            const isAtWarning = lookup.custentity_customer_warning;
            const statusText = lookup.custentity_warningnotes;

            if (currentMsg) currentMsg.hide();

            if (isAtWarning) {
                currentMsg = message.create({
                    type: message.Type.ERROR,
                    title: 'CUSTOMER WARNING',
                    message: `${statusText}`
                });
                currentMsg.show();
            }
        } else {
            if (currentMsg) currentMsg.hide();
        }
    };

    return {
        // Triggers when creating a Case from the Customer record (Pre-populated)
        pageInit: (context) => {
            checkAtWarning(context.currentRecord);
        },
        // Triggers if the user manually changes the customer on the Case
        fieldChanged: (context) => {
            if (context.fieldId === 'company') {
                checkAtWarning(context.currentRecord);
            }
        }
    };
});