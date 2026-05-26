/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */
define(['N/record', 'N/log'], function(record, log) {
    function onAction(scriptContext) {
        try {
            var customRec = scriptContext.newRecord;
            
            // 1. Get the Linked Employee ID using your specific field ID
            var employeeId = customRec.getValue({ fieldId: 'custrecord_ims_sub_empl_link' });

            if (!employeeId) {
                log.error('ID Error', 'The link field custrecord_ims_sub_empl_link is empty.');
                return;
            }

            // 2. Pull values from Custom Record - VERIFY THESE IDs in your system
            var firstName  = customRec.getValue({ fieldId: 'custrecord1540' }) || '';
            var lastName   = customRec.getValue({ fieldId: 'custrecord1541' }) || '';
            var emailAddr  = customRec.getValue({ fieldId: 'custrecord1542' }) || '';
            var isInactive = customRec.getValue({ fieldId: 'isinactive' }); 

            // 3. Validation: NetSuite requires First and Last name for Employees
            if (firstName === '' || lastName === '') {
                log.error('Validation Error', 'First or Last Name is blank. NetSuite requires these to update an Employee.');
                return;
            }

            // 4. Update the Employee
            // We use an object for values to keep it clean
            var updateValues = {
                'firstname': firstName,
                'lastname': lastName,
                'email': emailAddr,
                'custentity_nx_mobile_user': !isInactive, // Checked if Active, Unchecked if Inactive
                'isinactive': isInactive
            };

            record.submitFields({
                type: record.Type.EMPLOYEE,
                id: employeeId,
                values: updateValues,
                options: {
                    ignoreMandatoryFields: true 
                }
            });

            log.audit('Sync Success', 'Employee ' + employeeId + ' synchronized with Custom Record.');

        } catch (e) {
            // This will catch the "Illegal ID" if the ID exists but is the wrong Type (e.g. Vendor vs Employee)
            log.error('Update Failed', e.name + ': ' + e.message);
        }
    }

    return { onAction: onAction };
});