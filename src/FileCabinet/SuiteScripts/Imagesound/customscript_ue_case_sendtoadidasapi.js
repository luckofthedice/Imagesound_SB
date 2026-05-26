/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/log', 'N/https', 'N/encode', 'N/search', 'N/runtime'],  

    function(record, log, https, encode, search, runtime) {
        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */

        var adidasBaseUrl = 'https://adidasaspen.service-now.com/api/now/table/incident'
        var adidasApiUsername = 'imagesound_webservice'
        var adidasApiPassword = '6Eu3YY6YE4n9kRp'

        const AdidasCustomerCode = "ADI005"
        const AdidasStatusId_NewCase = 1
        const AdidasStatusId_AwaitingCustomer = 4
        const AdidasStatusId_InProcess = 3
        const AdidasStatusId_Pending = 5
        const AdidasStatusId_Closed = 6

        const NetSuiteStatusId_NewCase = 1
        const NetSuiteStatusId_InitialChecks = 2
        const NetSuiteStatusId_Escalation = 3
        const NetSuiteStatusId_EnhancedChecks = 4
        const NetSuiteStatusId_Closed = 5
        const NetSuiteStatusId_FollowUp1st2ndLine = 6
        const NetSuiteStatusId_MediaDistribution = 7
        const NetSuiteStatusId_Despatch = 8
        const NetSuiteStatusId_AwaitingDelivery = 9
        const NetSuiteStatusId_Quotations = 10
        const NetSuiteStatusId_QuotationsPendingInfo = 11
        const NetSuiteStatusId_QuotationsProjectManagement = 12
        const NetSuiteStatusId_MediaCreativeAdvertising = 13
        const NetSuiteStatusId_MediaCreativeMusic = 14
        const NetSuiteStatusId_SoftwareSupport = 15
        const NetSuiteStatusId_AwaitingCustomer = 16
        const NetSuiteStatusId_AwaitingCustomerAdvertising = 17
        const NetSuiteStatusId_AwaitingCustomerQuotations = 18
        const NetSuiteStatusId_AwaitingCustomerBDMs = 19
        const NetSuiteStatusId_AwaitingCustomerMusic = 20
        const NetSuiteStatusId_AwaitingCustomerSoftwareSupport = 21
        const NetSuiteStatusId_PlayerReplacement = 22
        const NetSuiteStatusId_EngineerSent = 23
        const NetSuiteStatusId_EngineerSentAwaitingStock = 24
        const NetSuiteStatusId_EngineerSentCompletePendingCosts = 25
        const NetSuiteStatusId_PendingClosure = 26
        const NetSuiteStatusId_CallOnHold = 27
        const NetSuiteStatusId_Escalation3rdLine = 28


        const NetSuiteContext_UserInterface = 'USERINTERFACE'
        const NetSuiteCustormFormId_IMSCaseForm = 552

        function afterSubmit(scriptContext) {
          try {

            var customFormType = scriptContext.newRecord.getValue({
                fieldId: 'customform'
            })

            if (customFormType !== NetSuiteCustormFormId_IMSCaseForm) {
                log.debug('Invalid Form Type', customFormType)
                return
            }
            
            var executionContext = runtime.executionContext;
            
            log.debug('Execution Context Check', {
                actualValue: runtime.executionContext,
                constantValue: runtime.ContextType.USERINTERFACE
            });
            
            if (executionContext.toUpperCase() !== NetSuiteContext_UserInterface) {
                log.debug('Skipping script', 'Execution context is: ' + executionContext);
                return;
            }

            if (scriptContext.type === scriptContext.UserEventType.CREATE || scriptContext.type === scriptContext.UserEventType.EDIT) {

                var customerCode = GetCustomerCodeForCaseRecord(scriptContext.newRecord);
              
                if (customerCode === AdidasCustomerCode) {
                    if (scriptContext.type === scriptContext.UserEventType.CREATE) {
                        CreateExternalAdidasCase(scriptContext)
                    }
                    
                    if (scriptContext.type === scriptContext.UserEventType.EDIT)
                    {
                        UpdateExternalAdidasCase(scriptContext)
                    }
                }
            }
          } catch (error) {
            log.error('Error checking Customer Code/Number', error.message);
          }
        }

        function GetCustomerCodeForCaseRecord(objRecord)
        {
            var propertyId = objRecord.getValue({
                fieldId: 'company'
            });

            var propertyCustomerRecord = record.load({
                type: record.Type.CUSTOMER,
                id: propertyId,
                isDynamic: true
            });

            var customerId = propertyCustomerRecord.getValue(
                {
                    fieldId: 'custentity_nb2_customersegment'
                }
            )

            var customerRecord = record.load({
                type: 'customrecord_nb2_ch_lev_cus_rec',
                id: customerId,
                isDynamic: true
            });

            var customerCode = customerRecord.getValue({
                fieldId: 'custrecord_nb2_ch_lev_cus_num_cod'
            })

            return customerCode;
        }

        function CreateExternalAdidasCase(scriptContext)
        {
            try {
                var headers = CreateRequestHeaders();

                var savedCase = record.load({
                    type: record.Type.SUPPORT_CASE,
                    id: scriptContext.newRecord.id,
                    isDynamic: false
                });
                var propertyId = savedCase.getValue({fieldId: 'company'});

                var propertyCustomerRecord = record.load({
                    type: record.Type.CUSTOMER,
                    id: propertyId,
                    isDynamic: true
                });

                var imagesoundStatus = savedCase.getValue({fieldId: 'status'});
                var caseTitle = savedCase.getValue({fieldId: 'title'})
                var internalId = savedCase.getValue({fieldId: 'supportcase'})
                var priorityId = savedCase.getValue({ fieldId: 'priority' });
                var caseNumber = savedCase.getValue({ fieldId: 'casenumber' });
                
                var storeCode = propertyCustomerRecord.getValue({fieldId: 'custentity_nb2_site_no'})
                var propertyName = propertyCustomerRecord.getValue({fieldId: 'companyname'})

                var adidasStatus = GetAdidasStateFromImagesoundStatus(imagesoundStatus)
                var supportCaseMessage = GetLatestCaseMessage(savedCase);

                var description = "Imagesound Case Number: " + caseNumber + ' - Imagesound Store Name: ' + propertyName + ' - Message: ' + supportCaseMessage;

                const Urgency_Normal = 3
                const Urgency_High = 1
                const Impact_Default = 2

                const NetSuitePriorityId_1 = 2
                const NetSuitePriorityId_2 = 1
                const NetSuitePriorityId_Normal = 3

                var newUrgency = Urgency_Normal;
                var newImpact = Impact_Default;

                switch (priorityId) {
                    case NetSuitePriorityId_Normal:
                        newUrgency = Urgency_Normal;
                        newImpact = Impact_Default;
                        break;
                    case NetSuitePriorityId_1:
                    case NetSuitePriorityId_2:
                        newUrgency = Urgency_High;
                        newImpact = Impact_Default;
                        break;
                    default:
                        break;
                }

                var payload = {
                    number: "0",
                    u_reference_number: internalId,
                    description: description,
                    short_description: caseTitle,
                    u_ticket_type: "INC",
                    u_service: "Sales - Retail",
                    u_subservice: "Store Music",
                    u_category: "*",
                    contact_type: "event",
                    assignment_group: "7313cd1637ff0a005299db9643990e10",
                    state : adidasStatus,
                    caller_id : storeCode,
                    impact : newImpact,
                    urgency : newUrgency,
                    u_opened_by_group: "bbba4066dba873841d398edf4b96197f",
                    work_notes: "",
                    close_code:"",
                    close_notes:"",
                    ticket_number:"",
                    u_supplier:"IMAGESOUND",
                    u_external_ticket_system:"ImageSound",
                    id: ""
                }
                log.audit('Payload', payload);
    
                var response = https.post({
                    url: adidasBaseUrl,
                    headers: headers,
                    body: JSON.stringify(payload)
                });

                log.audit('Response', 'Code: ' + response.code + ' Body: ' + response.body);

                var incidentNumber = GetIncidentNumberFromResponse(response)
                var currentDate = new Date();

                record.submitFields({
                    type: record.Type.SUPPORT_CASE,
                    id: savedCase.id,
                    values: {
                        custevent_nb2_sd_external_id: incidentNumber,
                        custevent_ims_last_adidas_update: currentDate
                    }
                });

                log.audit({
                    title: 'Updated Case Field',
                    details: `Case updated with external ID (Adidas incident number): ${incidentNumber}`
                });
            } catch (error) {
                log.error('Error sending POST request', error);
            }
        }

        function UpdateExternalAdidasCase(scriptContext)
        {
            try {
                const defaultDescription = "Not Supplied"
                const closureCode = "Solved (Permanently)";

                var savedCase = record.load({
                    type: record.Type.SUPPORT_CASE,
                    id: scriptContext.newRecord.id,
                    isDynamic: false
                });

                var ticketId = savedCase.getValue({
                    fieldId: 'custevent_nb2_sd_external_id'
                })

                if (ticketId === null || ticketId === '') {
                    log.error("External ID", "No external ID on support case record")
                    return
                }

                var imagesoundStatus = savedCase.getValue({
                    fieldId: 'status'
                });
                var adidasStatus = GetAdidasStateFromImagesoundStatus(imagesoundStatus)
                var caseTitle = savedCase.getValue({
                    fieldId: 'title'
                })

                var latestSupportMessage = GetLatestCaseMessage(savedCase);

                var headers = CreateRequestHeaders();
                var payload = {
                    description: defaultDescription,
                    short_description: caseTitle,
                    state: adidasStatus,
                    work_notes: "",
                    close_code: "",
                    close_notes: ""
                }

                if (adidasStatus === AdidasStatusId_Closed) {
                    payload.close_notes = latestSupportMessage
                    payload.close_code = closureCode
                }
                else
                {
                    payload.work_notes = latestSupportMessage
                }

                log.audit('Update Payload', payload);

                var response = https.put({
                    url: adidasBaseUrl + "/" + ticketId,
                    headers: headers,
                    body: JSON.stringify(payload)
                });
                
                log.audit("Update Response", response)

                var incidentNumber = GetIncidentNumberFromResponse(response)
                if (!incidentNumber) 
                {
                    log.error({
                        title: 'Failed to update support case in Adidas ticketing system.',
                        details: 'Response from Adidas Ticketing API: ' + JSON.stringify(response)
                    });
                } 
                else 
                {
                    var currentDate = new Date();
                    record.submitFields({
                        type: record.Type.SUPPORT_CASE,
                        id: savedCase.id,
                        values: {
                            custevent_ims_last_adidas_update: currentDate
                        }
                    });
                    log.audit({
                        title: 'Support case has been updated in Adidas ticketing system.',
                        details: 'Incident Number: ' + incidentNumber
                    });
                }
            } catch (error) {
                log.error('Error sending PUT request', error);
            }
        }

         function CreateRequestHeaders()
         {
             var authHeader = 'Basic ' + encode.convert({
                 string: adidasApiUsername + ':' + adidasApiPassword,
                 inputEncoding: encode.Encoding.UTF_8,
                 outputEncoding: encode.Encoding.BASE_64
             });

            var headers = {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            return headers
         }

        function GetAdidasStateFromImagesoundStatus(statusId)
        {
            statusId = parseInt(statusId, 10);
            switch (statusId) {
                case NetSuiteStatusId_NewCase:
                case NetSuiteStatusId_InitialChecks:
                case NetSuiteStatusId_Escalation:
                case NetSuiteStatusId_EnhancedChecks:
                case NetSuiteStatusId_FollowUp1st2ndLine:
                case NetSuiteStatusId_Escalation3rdLine:
                    return AdidasStatusId_NewCase;
                case NetSuiteStatusId_AwaitingCustomer:
                case NetSuiteStatusId_AwaitingCustomerAdvertising:
                case NetSuiteStatusId_AwaitingCustomerQuotations:
                case NetSuiteStatusId_AwaitingCustomerBDMs:
                case NetSuiteStatusId_AwaitingCustomerMusic:
                case NetSuiteStatusId_AwaitingCustomerSoftwareSupport:
                    return AdidasStatusId_AwaitingCustomer;
                case NetSuiteStatusId_MediaDistribution:
                case NetSuiteStatusId_Despatch:
                case NetSuiteStatusId_AwaitingDelivery:
                case NetSuiteStatusId_Quotations:
                case NetSuiteStatusId_QuotationsPendingInfo:
                case NetSuiteStatusId_QuotationsProjectManagement:
                case NetSuiteStatusId_MediaCreativeAdvertising:
                case NetSuiteStatusId_MediaCreativeMusic:
                case NetSuiteStatusId_SoftwareSupport:
                case NetSuiteStatusId_PlayerReplacement:
                case NetSuiteStatusId_EngineerSent:
                case NetSuiteStatusId_EngineerSentAwaitingStock:
                case NetSuiteStatusId_EngineerSentCompletePendingCosts:
                    return AdidasStatusId_InProcess;
                case NetSuiteStatusId_PendingClosure:
                case NetSuiteStatusId_CallOnHold:
                    return AdidasStatusId_Pending;
                case NetSuiteStatusId_Closed:
                    return AdidasStatusId_Closed;
                default:
                    break;
            }
        }

        function GetLatestCaseMessage(caseRecord) {
            try {
                var caseId = caseRecord.id;

                if (!caseId) {
                    log.debug('No Case ID', 'Case record has no ID.');
                    return "No messages found for support case.";
                }

                var caseSearch = search.create({
                    type: search.Type.SUPPORT_CASE,
                    filters: [
                        ['internalid', 'anyof', caseId],
                        'AND',
                        ['messages.message', 'isnotempty', ''],    
                        'AND',
                        ['messages.internalonly', 'is', 'F']       
                    ],
                    columns: [
                        search.createColumn({ name: 'messagedate', join: 'messages', sort: search.Sort.DESC }),
                        search.createColumn({ name: 'message', join: 'messages' })
                    ]
                });

                // Run search and get the latest message
                var results = caseSearch.run().getRange({ start: 0, end: 1 });

                if (results && results.length > 0) {
                    var latestMessage = results[0].getValue({ name: 'message', join: 'messages' });

                    latestMessage = stripHtmlTags(latestMessage);

                    return latestMessage || "No message text found.";
                } else {
                    log.debug('No Non-Internal Messages Found', 'Search returned zero results.');
                    return "No messages found for support case.";
                }

            } catch (error) {
                log.error({
                    title: 'Error retrieving latest case message',
                    details: error
                });
                return "Error retrieving latest message.";
            }
        }

        function GetIncidentNumberFromResponse(response)
        {
            if (response.body && response.body.indexOf('sys_id') !== -1) {
                let parsed;
                try {
                    parsed = JSON.parse(response.body);
                } catch (err) {
                    log.error({ title: 'JSON Parse Error', details: err });
                    return "";
                }

                const sysId = parsed?.result?.sys_id;

                if (sysId && sysId.trim() !== '') {
                    log.audit({ title: 'Extracted sys_id', details: sysId });
                    return sysId;
                }
            }
        }

        function stripHtmlTags(htmlString) {
            if (!htmlString) return '';
            return htmlString.replace(/<[^>]*>/g, '');
        }

        return {
            afterSubmit: afterSubmit
        };
    });