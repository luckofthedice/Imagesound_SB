/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/format', 'N/record', 'N/search', './nb2_spz_lib', 'N/task'],
    /**
 * @param{format} format
 * @param{record} record
 * @param{search} search
 */
    (format, record, search, spzLib, task) => {
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
            /** @NApiVersion 2.1 */
            return search.create({
                type: "invoice",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters:
                    [
                        ["type","anyof","CustInvc"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["cogs","is","F"],
                        "AND",
                        ["custcolzab_created_by_zone_billing","is","T"],
                        "AND",
                        ["custbody_nb2_spz_retroupdate","is","T"]
                    ],
                columns:
                    [
                        "internalid",
                        "item",
                        "custcol_nb2_contract_startdate",
                        "custcol_nb2_contract_enddate",
                        "rate",
                        "memo",
                        "line",
                        "custcol_nb2_zab_charge",
                        "custbody_nb2_zab_subscription_link"
                    ]
            });

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
            const invoiceId = mapContext.key;
            const rec = JSON.parse(mapContext.value).values;
            log.debug('map', rec);

            const parseDate = (val) => format.parse({ type: format.Type.DATE, value: val });
            const [zsId, zcId, itemId] = ['custbody_nb2_zab_subscription_link', 'custcol_nb2_zab_charge', 'item']
                .map(f => rec[f].value);

            const [serviceStart, serviceEnd] = ['custcol_nb2_contract_startdate', 'custcol_nb2_contract_enddate']
                .map(f => parseDate(rec[f]));

            const { rate: chargeAmount, memo: chargeDescription, line: lineId } = rec;

            log.debug('map consts', { invoiceId, zsId, zcId, itemId, serviceStart, serviceEnd, chargeAmount, chargeDescription });

            const spzId = spzLib.createSPZ(zcId, zsId, itemId, serviceStart, serviceEnd, chargeAmount, chargeDescription, invoiceId);
            mapContext.write(invoiceId, { lineId, spzId });

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
            const invoiceId = reduceContext.key;
            log.debug('reduce', { key: invoiceId, values: reduceContext.values });

            const invRec = record.load({ type: record.Type.INVOICE, id: invoiceId });

            for (const { lineId, spzId } of reduceContext.values.map(JSON.parse)) {
                const lineIdx = invRec.findSublistLineWithValue({ sublistId: 'item', fieldId: 'line', value: lineId });
                log.debug('reduce', { key: invoiceId, lineId, spzId, lineIdx });
                invRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_nb2_spz', value: spzId, line: lineIdx });
            }

            invRec.setValue({ fieldId: 'custbody_nb2_spz_retroupdate', value: false });
            invRec.save();

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

            if (!!summaryContext.inputSummary.error) {
                log.error('Input Error', summaryContext.inputSummary.error);
            }

            summaryContext.mapSummary.errors.iterator().each(
                function (key, error, executionNo) {
                    var errorObject = JSON.parse(error);
                    log.error({
                        title:  'Map error for key: ' + key + ', execution no. ' + executionNo,
                        details: errorObject.name + ': ' + errorObject.message
                    });
                    return true;
                }
            );

            summaryContext.reduceSummary.errors.iterator().each(function (key, error, executionNo){
                log.error({
                    title: 'Reduce error for key: ' + key + ', execution no. ' + executionNo,
                    details: error
                });
                return true;
            });

            let reduceKeyCount = 0;
            summaryContext.reduceSummary.keys.iterator().each(function (key)
            {
                reduceKeyCount += 1;
                return true;
            });

            if (reduceKeyCount > 0) {
                try {
                    const mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: 'customscript_nb2_invoice_spz_mr',
                        deploymentId: 'customdeploy_nb2_invoice_spz_mr'
                    });
                    mrTask.submit();
                } catch (e) {
                    // if it errors it's because the script has already been added back to the processor queue, and the error is fine!
                }
            }

        }

        return {getInputData, map, reduce, summarize}

    });
