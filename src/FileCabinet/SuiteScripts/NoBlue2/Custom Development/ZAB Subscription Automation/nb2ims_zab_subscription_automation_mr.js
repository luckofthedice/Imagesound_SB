/**
 * Name			: nb2ims_zab_subscription_automation_mr.js
 * Property of 	: NoBlue2
 * Customer		: ImageSound
 * Type			: Map/Reduce
 * Comments		: Generate Subscription Item
 * NOTES		:
 *
 * Version		Date            	Author              Remarks
 * 1.0          04/02/2025          NoBlue2(JT)         Conversion of WAS Subscription Automation into MR
 */
/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define([
            'N/record',
            'N/search',
            'N/format',
            'N/runtime',
            './nb2ims_zab_subscription_automation_gen_lib.js'
    ],
    
    (
        record,
        search,
        format,
        runtime,
        NB2ZSLib
     ) => {
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            log.debug({
                title: `SCRIPT START`,
                details: '_____________________________________'
            })
            let scriptParameter = runtime.getCurrentScript();
            let zabSubscriptionHeaderSearch = scriptParameter.getParameter({name: 'custscript_nb2_czs_header_search_mr'});
            if(zabSubscriptionHeaderSearch){
                let zabSubscriptionHeaderSearchObj = search.load({id: zabSubscriptionHeaderSearch});
                log.debug('zabSubscriptionHeaderSearchObj',{zabSubscriptionHeaderSearchObj});
                return zabSubscriptionHeaderSearchObj;
            }
            return [];
        }

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {
            log.debug('mapContext.key = '+mapContext.key,{mapContext});

            let zabSubscriptionHeaderSearchResult = JSON.parse(mapContext.value);
            log.debug('zabSubscriptionHeaderSearchResult',{zabSubscriptionHeaderSearchResult});


            //GET THE ZAB HEADER DETAILS AND STORE IT IN OBJECT
            let zabSubscriptionHeaderDetails = NB2ZSLib.getZABSubscriptionHeaderDetails({searchResult: zabSubscriptionHeaderSearchResult});
            log.debug('zabSubscriptionHeaderDetails',zabSubscriptionHeaderDetails);

            //CREATE THE ZAB SUBSCRIPTION BASED ON HEADER DETAILS
            let subscriptionId = NB2ZSLib.createZABSubscription(zabSubscriptionHeaderDetails);
            if(subscriptionId){
                log.debug('SUBSCRIPTION ID:'+subscriptionId +' HAS BEEN SUCCESSFULLY CREATED FOR ESTIMATE ID:' +mapContext.key);


                //GET THE ZAB ITEM SEARCH REFERENCE
                let zabSubscriptionItemSearch = runtime.getCurrentScript().getParameter('custscript_nb2_czs_item_search_mr');

                //LOAD THE ZAB ITEM SEARCH AND FILTER IT BY RECORD INTERNAL ID
                let zabSubscriptionItemSearchObj = NB2ZSLib.filterByRecordId({searchObject:search.load({id: zabSubscriptionItemSearch}), recId: mapContext.key});
                log.debug('zabSubscriptionItemSearchObj',{zabSubscriptionItemSearchObj});

                //RUN THE ZAB ITEM SEARCH
                let zabSubscriptionItemSearchResult = NB2ZSLib.getAllResults(zabSubscriptionItemSearchObj);
                log.debug('zabSubscriptionItemSearchResult',{zabSubscriptionItemSearchResult});

                if(zabSubscriptionItemSearchResult.length > 0){

                    //LOOP THE THRU RESULT
                    for(let x=0; x<zabSubscriptionItemSearchResult.length; x++){

                        //GET THE ZAB ITEM DETAILS AND STORE IT IN OBJECT
                        let zabSubscriptionItemDetails = NB2ZSLib.getZABSubscriptionItemDetails({searchResult: zabSubscriptionItemSearchResult, line: x, subscriptionId: subscriptionId});
                        log.debug('mapContext.write({\n' +
                            '                            key: mapContext.key+\'_\'+subscriptionId+\'_\'+x,\n' +
                            '                            value: zabSubscriptionItemDetails\n' +
                            '                        }) = ',mapContext.key+'_'+subscriptionId+'_'+x)
                        mapContext.write({
                            key: mapContext.key+'_'+subscriptionId+'_'+x,
                            value: zabSubscriptionItemDetails
                        });
                    }

                    record.submitFields({
                        type: record.Type.ESTIMATE,
                        id: mapContext.key,
                        values: {
                            custbody_nb2_zab_subscription_link: subscriptionId
                        },
                        options: {
                            ignoreMandatoryFields: true
                        }
                    });


                    log.debug('SUBSCRIPTION HAS BEEN SUCCESSFULLY TAGGED TO ESTIMATE ID:' +mapContext.key);
                }
            }
        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {
            log.debug('reduceContext.key = ' + reduceContext.key, { reduceContext });
            let zabSubscriptionItemDetails = JSON.parse(reduceContext.values[0]);
            log.debug('zabSubscriptionItemDetails',{zabSubscriptionItemDetails});

            //CREATE THE ZAB SUBSCRIPTION ITEM BASED ON ITEM DETAILS
            NB2ZSLib.createZABSubscriptionItem(zabSubscriptionItemDetails);

        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {
            summaryContext.mapSummary.errors.iterator().each(
                function (key, error, executionNo) {
                    log.error({
                        title: 'Map error for key: ' + key + ', execution no.  ' + executionNo,
                        details: error
                    });
                    return true;
                }
            );
            summaryContext.reduceSummary.errors.iterator().each(
                function (key, error, executionNo) {
                    log.error({
                        title: 'Reduce error for key: ' + key + ', execution no.  ' + executionNo,
                        details: error
                    });
                    return true;
                }
            );

            summaryContext.output.iterator().each(function (key, value) {
                log.audit({
                    title: ' summary.output.iterator',
                    details: 'key: ' + key + ' / value: ' + value
                });
                return true;
            });


            log.debug({
                title: `SCRIPT FINISHED`,
                details: '_____________________________________'
            })
        }

        return {getInputData, map, reduce, summarize}

    });
