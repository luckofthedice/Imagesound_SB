//need to be 2.x as the rtx plug-in type is in 2.x
//cannot use let as well because it's 2.x

/**
 * @NApiVersion 2.x
 * @NScriptType plugintypeimpl
 */
define(['N/record','N/log','N/workflow'],
    /**
     * @param{record} record
     */
    function(record,log,workflow)     {

        function parseResponse (rtQueueId) {
            log.debug('plugin parserResponse rtQueueId',rtQueueId)
            var rtxRec = record.load({type: 'customrecord_nbs_record_transmission', id: rtQueueId});
            var pluginStatus = '2'
            try
            {
                var rtxFullResponseStr = rtxRec.getValue({fieldId: 'custrecord_nbs_rtx_response'});
                var recType= rtxRec.getValue({fieldId: 'custrecord_nbs_rtx_rec_type'});
                var recId= rtxRec.getValue({fieldId: 'custrecord_nbs_rtx_rec'});
                var processType= rtxRec.getValue({fieldId: 'custrecord_nbs_rtx_string1'});
                var workflowId= rtxRec.getValue({fieldId: 'custrecord_nbs_rtx_string2'});
                var actionId= rtxRec.getValue({fieldId: 'custrecord_nbs_rtx_string3'});

                var workflowRecordId= rtxRec.getValue({fieldId: 'custrecord_nbs_rtx_rec2'});
                var workflowRecordType= rtxRec.getValue({fieldId: 'custrecord_nbs_rtx_rec_type2'});

                var rtxFullResponseJSON = (typeof(rtxFullResponseStr) == 'object' ? rtxFullResponseStr : JSON.parse(rtxFullResponseStr))
                log.debug('plugin rtxFullResponseJSON',rtxFullResponseJSON)
                log.debug('plugin rtxFullResponseJSON.code',rtxFullResponseJSON.code)
                log.debug('plugin processType',processType)
                if((rtxFullResponseJSON.hasOwnProperty('code') == true))
                {
                    log.debug('plugin rtxFullResponseJSON.code2',rtxFullResponseJSON.code ==201)
                    //201- POST , 204 -  PUT
                    if(rtxFullResponseJSON.code == 201 || rtxFullResponseJSON.code == 204)
                    {
                      
                        if(rtxFullResponseJSON.code == 201)
                        {
                            log.debug('plugin rtxFullResponseJSON.body',rtxFullResponseJSON.body)
                            var imsRecId = rtxFullResponseJSON.body;
                            var hasUpdate = false;
                            var valuesToUpdate = {};
                            switch (processType)
                            {
                                case 'CustomerSegment':
                                    valuesToUpdate['custrecord_nb2_ch_created_ims'] = true;
                                    hasUpdate = true;
                                    break;
                                case 'Player':
                                case 'Zone':
                                case 'Property':
                                case 'Brand':
                                case 'BrandParent':
                                    valuesToUpdate['custentity_nb2_ims_id'] = imsRecId.toString();
                                    hasUpdate = true;
                                    break;  
                                case 'Address':
                                    valuesToUpdate['custentity_nb2_ims_addr_id'] = imsRecId.toString();
                                    hasUpdate = true;
                                    break;


                            }

                            try
                            {
                                log.debug('plugin imsRecId',imsRecId)
                                if(hasUpdate)
                                {
                                    
                                    log.debug('valuesToUpdate','id: '+recId+ ' Type: '+recType+   ' value:'+JSON.stringify(valuesToUpdate))
                                    var updatedRecId = record.submitFields({type: recType, id: recId, values: valuesToUpdate})
                                    log.audit('plugin updatedRecId', updatedRecId);

                                    rtxRec.setValue({fieldId: 'custrecord_nbs_rtx_responseparser_result', value: 'Updated Record Internal ID: ' + updatedRecId});
                                    pluginStatus = '2'
                                }
                                log.debug('workflow details', {
                                    recordId: workflowRecordId,
                                    recordType: workflowRecordType,
                                    workflowId: workflowId,
                                    actionId: actionId
                                });
                                
                            }
                            catch(er)
                            {
                                rtxRec.setValue({fieldId: 'custrecord_nbs_rtx_responseparser_result', value: er.message});
                                pluginStatus = '3'
                            }
                        }
                        try{
                            if (workflowId && actionId && workflowRecordId && workflowRecordType)
                                {
                                    
                                    var workflowInstanceId = workflow.trigger({
                                        recordId: workflowRecordId,
                                        recordType:workflowRecordType,
                                        workflowId: workflowId,
                                        actionId: actionId
                                    });
                                    log.debug('workflow triggered for', workflowRecordType + ' id: ' + workflowRecordId + ' workflowId: ' + workflowId + ' actionId: ' + actionId + ' instanceId: ' + workflowInstanceId);

                                }
                        } 
                        catch(er)
                        {
                            rtxRec.setValue({fieldId: 'custrecord_nbs_rtx_responseparser_result', value: er.message});
                            pluginStatus = '3'
                        }

                    }
                    else
                    {
                        rtxRec.setValue({fieldId: 'custrecord_nbs_rtx_responseparser_result', value: 'Error in response results'});
                        pluginStatus = '2'
                    }

                }
                else
                {
                    rtxRec.setValue({fieldId: 'custrecord_nbs_rtx_responseparser_result', value: 'Error in response results'});
                    pluginStatus = '2'
                }

            }
            catch (e)
            {
                log.debug('plugin parseError', e);
                pluginStatus = '3'
                rtxRec.setValue({
                    fieldId: 'custrecord_nbs_rtx_responseparser_result',
                    value: e.toString()
                });

            } finally {
                rtxRec.setValue({fieldId: 'custrecord_nbs_rtx_responseparser_status', value: pluginStatus});
                rtxRec.save();
            }

        }


        return {
            parseResponse: parseResponse,
        };


});

