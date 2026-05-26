/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
/**
 *
 * @summary     : Main Hub for all ZAB Subscription Automation logic.
 *
 * @description :
 *
 * @name        : nb2ims_zab_subscription_automation_gen_lib.js
 * @copyright   : NoBlue2
 * @author      : JMT
 * @created     : 28/08/2025
 *
 * Version          Date                Author              Note
 * 1.0              28/08/2025          NB2(JT)            IS1026-424 : Imagesound - Opportunity to ZAB Subscription Customisation | Initial Build
 *
 */
define(['N/record', 'N/search', 'N/format', 'N/runtime','./nb2ims_zab_subscription_automation_gen_lib.js'],

    (record, search, format, runtime, NB2ZSLib) => {
        /**
         * Defines the WorkflowAction script trigger point.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.workflowId - Internal ID of workflow which triggered this action
         * @param {string} scriptContext.type - Event type
         * @param {Form} scriptContext.form - Current form that the script uses to interact with the record
         * @since 2016.1
         */
        const onAction = (scriptContext) => {
            let subscriptionId = '';
            let rec = scriptContext.newRecord;
            try{
                let recId = rec.id;
                log.debug('START Script - nb2ims_zab_subscription_automation_wa.js',recId);

                //GET THE ZAB HEADER SEARCH REFERENCE
                let zabSubscriptionHeaderSearch = runtime.getCurrentScript().getParameter('custscript_nb2_czs_header_search');

                //LOAD THE ZAB HEADER SEARCH AND FILTER IT BY RECORD INTERNAL ID
                let zabSubscriptionHeaderSearchObj = NB2ZSLib.filterByRecordId({searchObject:search.load({id: zabSubscriptionHeaderSearch}), recId: recId});
                // log.debug('zabSubscriptionHeaderSearchObj',{zabSubscriptionHeaderSearchObj});

                //RUN THE ZAB HEADER SEARCH
                let zabSubscriptionHeaderSearchResult = NB2ZSLib.getAllResults(zabSubscriptionHeaderSearchObj);
                log.debug('zabSubscriptionHeaderSearchResult',{zabSubscriptionHeaderSearchResult});

                if(zabSubscriptionHeaderSearchResult.length > 0){

                    //GET THE ZAB HEADER DETAILS AND STORE IT IN OBJECT
                    let zabSubscriptionHeaderDetails = NB2ZSLib.getZABSubscriptionHeaderDetails({searchResult: zabSubscriptionHeaderSearchResult});
                    log.debug('zabSubscriptionHeaderDetails',zabSubscriptionHeaderDetails);

                    //CREATE THE ZAB SUBSCRIPTION BASED ON HEADER DETAILS
                    subscriptionId = NB2ZSLib.createZABSubscription(zabSubscriptionHeaderDetails);
                    // record.delete({type: 'customrecordzab_subscription', id: subscriptionId});

                    if(subscriptionId){
                        //GET THE ZAB ITEM SEARCH REFERENCE
                        let zabSubscriptionItemSearch = runtime.getCurrentScript().getParameter('custscript_nb2_czs_item_search');

                        //LOAD THE ZAB ITEM SEARCH AND FILTER IT BY RECORD INTERNAL ID
                        let zabSubscriptionItemSearchObj = NB2ZSLib.filterByRecordId({searchObject:search.load({id: zabSubscriptionItemSearch}), recId: recId});
                        // log.debug('zabSubscriptionItemSearchObj',{zabSubscriptionItemSearchObj});

                        //RUN THE ZAB ITEM SEARCH
                        let zabSubscriptionItemSearchResult = NB2ZSLib.getAllResults(zabSubscriptionItemSearchObj);
                        // log.debug('zabSubscriptionItemSearchResult',{zabSubscriptionItemSearchResult});

                        if(zabSubscriptionItemSearchResult.length > 0){

                            //LOOP THE THRU RESULT
                            for(let x=0; x<zabSubscriptionItemSearchResult.length; x++){

                                //GET THE ZAB ITEM DETAILS AND STORE IT IN OBJECT
                                let zabSubscriptionItemDetails = NB2ZSLib.getZABSubscriptionItemDetails({searchResult: zabSubscriptionItemSearchResult, line: x, subscriptionId: subscriptionId});
                                log.debug('zabSubscriptionItemDetails',zabSubscriptionItemDetails);

                                //CREATE THE ZAB SUBSCRIPTION ITEM BASED ON ITEM DETAILS
                                NB2ZSLib.createZABSubscriptionItem(zabSubscriptionItemDetails);

                            }

                        }
                        else{
                            throw 'Unable to Process ZAB Subscription Item for '+rec.getValue({fieldId: 'tranid'}) +' : '+zabSubscriptionHeaderDetails.name;

                            if(subscriptionId){
                                record.delete({type: 'customrecordzab_subscription', id: subscriptionId});
                            }
                        }
                    }
                }

                log.debug('END Script - nb2ims_zab_subscription_automation_wa.js',rec.id);

                return subscriptionId;
            }
            catch (e) {
                log.error('nb2ims_zab_subscription_automation_wa.js ERROR',e);
                if(subscriptionId){
                    record.delete({type: 'customrecordzab_subscription', id: subscriptionId});
                    log.error('Deleted due to error while creating ZAB Subscription for '+rec.getValue({fieldId: 'tranid'}),e);
                }
            }
        }

        return {onAction};
    });
