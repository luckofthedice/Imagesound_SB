/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
/**
 *
 * @summary    : Main Hub for all ZAB Subscription Automation logic.
 *
 * @description :
 *
 * @name       : nb2ims_zab_subscription_automation_gen_lib.js
 * @copyright  : NoBlue2
 * @author     : JMT
 * @created    : 28/08/2025
 *
 *
 * Version          Date                Author              Note
 * 1.0              28/08/2025          NB2(JT)             IS1026-424: Imagesound - Opportunity to ZAB Subscription Customisation | Initial Build
 * 1.1              07/01/2026          NB2(JT)             IS1026-582 : PDF Invoice - Removed the Handle Bars for ZAB Item Description
 *
 */

define(['N/search', 'N/record', 'N/format'],
    (search, record, format) => {
        let exports = {};

        /**
         *
         * Function to get all results
         *
         */
        exports.getAllResults   = function (searchObj){
            let results = searchObj.run();
            let searchResults = [];
            let searchid = 0;
            let resultslice = '';
            do {
                resultslice = results.getRange({start:searchid,end:searchid+1000});

                resultslice.forEach(function(result)
                    {
                        searchResults.push(result);
                        searchid++;
                    }
                );
            } while (resultslice.length >=1000);
            return searchResults;
        }

        /**
         *
         * Function to Modify the existing search filter to include the record internal id filter
         *
         */
        exports.filterByRecordId = function(context){
            let filters = context.searchObject.filters;
            filters.push(search.createFilter({
                name: 'internalid',
                operator: search.Operator.ANYOF,
                values: [context.recId]
            }));
            context.searchObject.filters = filters;

            return context.searchObject;
        }

        /**
         *
         * Function to get all necessary details from ZAB Subscription Header
         *
         */
        exports.getZABSubscriptionHeaderDetails = function(context){
            let zabSubscriptionHeaderSearchResult = context.searchResult;
            let recId = zabSubscriptionHeaderSearchResult.id;
            let otherDetailsObj = this.getOtherDetails({id: recId});
            let minimumDate = otherDetailsObj.minimumDate;
            let shipAddress = otherDetailsObj.shipAddress;
            let tranid = otherDetailsObj.tranid;
            let customer = zabSubscriptionHeaderSearchResult.values['internalid.customerMain'].value;
            let name = zabSubscriptionHeaderSearchResult.values['entity'].text;
            let currency = zabSubscriptionHeaderSearchResult.values['currency'].value;
            let startDate = format.parse({
                value: minimumDate,
                type: format.Type.DATE
            });
            let endDate = format.parse({
                value: this.addMonthsAndOffset({date: minimumDate, months: 36, daysToSubtract: 1}),
                type: format.Type.DATE
            });
            let departmentId = zabSubscriptionHeaderSearchResult.values['department'].value;
            let classId = zabSubscriptionHeaderSearchResult.values['class'].value;
            let locationId = zabSubscriptionHeaderSearchResult.values['location'].value;
            let subsidiaryId = zabSubscriptionHeaderSearchResult.values['internalid.subsidiary'].value;
            let tranId = zabSubscriptionHeaderSearchResult.values['tranid'];

            return {
                customer: customer,
                name: name +' - '+tranid,
                currency: currency,
                startDate: startDate,
                endDate: endDate,
                departmentId: departmentId,
                classId: classId,
                locationId: locationId,
                subsidiaryId: subsidiaryId,
                externalId: tranId,
                shipAddress: shipAddress,
                id: recId,
                chargeSchedule: 1
            };
        }

        exports.getOtherDetails = function(context){
            let estRecord = record.load({
                type: record.Type.ESTIMATE,
                id: context.id
            });
            let lineCount = estRecord.getLineCount({sublistId: 'item'});
            let minimumDate = null;
            if(lineCount > 0){
                for(let x=0; x<lineCount; x++){
                    let dateStr = estRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_nb2_contract_startdate',
                        line: x
                    });

                    if (!dateStr) continue;

                    let thisDate = new Date(dateStr);

                    if (minimumDate === null || thisDate < minimumDate) {
                        minimumDate = thisDate;
                    }
                }
            }
            log.debug('minimumDate',{minimumDate});
            if(minimumDate === null){
                minimumDate = new Date();
            }
            let shipAddress = estRecord.getValue({fieldId: 'shipaddresslist'});
            let tranid = estRecord.getValue({fieldId: 'tranid'});
            return {minimumDate, shipAddress, tranid};
        }


        exports.addMonthsAndOffset = function (context) {
            // Clone original date
            let d = new Date(context.date.getTime());
            let origDay = d.getDate();

            // Add months
            d.setMonth(d.getMonth() + context.months);

            // If adding months rolled us into the next month (JS auto-adjust),
            // set to last day of previous month
            if (d.getDate() < origDay) {
                d.setDate(0);
            }

            // Add 12 extra months at a time until the date is beyond 2026
            while (d.getFullYear() < 2027) {
                let dayBeforeAdd = d.getDate();
                d.setMonth(d.getMonth() + 12);
                // Handle month-end roll-over after each 12-month addition
                if (d.getDate() < dayBeforeAdd) {
                    d.setDate(0);
                }
            }

            // Subtract days
            d.setDate(d.getDate() - context.daysToSubtract);

            return d;
        }


        /**
         *
         * Function to create the ZAB Subscription
         *
         */
        exports.createZABSubscription = function(context){
            log.debug('createZABSubscription',context);
            let subscriptionId = '';
            let zSubRec = record.create({type: 'customrecordzab_subscription', isDynamic: true});
            zSubRec.setValue({fieldId: 'custrecordzab_s_customer', value: context.customer});
            zSubRec.setValue({fieldId: 'name', value: context.name});
            zSubRec.setValue({fieldId: 'custrecordzab_s_currency', value: context.currency});
            zSubRec.setValue({fieldId: 'custrecordzab_s_start_date', value: context.startDate});
            zSubRec.setValue({fieldId: 'custrecordzab_s_end_date', value: context.endDate});
            zSubRec.setValue({fieldId: 'custrecordzab_s_department', value: context.departmentId});
            zSubRec.setValue({fieldId: 'custrecordzab_s_class', value: context.classId});
            zSubRec.setValue({fieldId: 'custrecordzab_s_location', value: context.locationId});
            zSubRec.setValue({fieldId: 'custrecordzab_s_subsidiary', value: context.subsidiaryId});
            zSubRec.setValue({fieldId: 'externalid', value: context.externalId});
            zSubRec.setValue({fieldId: 'custrecord_nb2_s_transaction', value: context.id});
            zSubRec.setValue({fieldId: 'custrecordzab_s_charge_schedule', value: context.chargeSchedule});
            zSubRec.setValue({fieldId: 'custrecordzab_s_shipping_address', value: context.shipAddress});
            subscriptionId = zSubRec.save({
                ignoreMandatoryFields: true
            });
            log.debug('subscriptionId',{subscriptionId});
            return subscriptionId;
        }

        /**
         *
         * Function to get all necessary details from ZAB Subscription Item
         *
         */
        exports.getZABSubscriptionItemDetails = function(context){
            let doNotProrate = 3;
            //START - 1.1 - JT
            // let itemDescription = '{{custrecord_nb2_c_ch_zone_name}} Period {{custrecordzab_c_start_date}} to {{custrecordzab_c_end_date}}';
            //END - 1.1 - JT
            let x = context.line;
            let subscriptionId = context.subscriptionId;
            let zabSubscriptionItemSearchResult = context.searchResult;
            let recId = zabSubscriptionItemSearchResult[x].getValue({name: "internalid", summary: "GROUP"});
            // let otherDetailsObj = this.getOtherDetails({id: recId});
            // let minimumDate = otherDetailsObj.minimumDate;  //custcol_nb2_contract_startdate
            let minimumDate = zabSubscriptionItemSearchResult[x].getValue({name: 'custcol_nb2_contract_startdate', summary: 'MIN'});
            let frequency = zabSubscriptionItemSearchResult[x].getValue({name: 'custcol_nb2_frequency', summary: 'GROUP'});
            let item = zabSubscriptionItemSearchResult[x].getValue({name: 'item', summary: 'GROUP'});
            let itemName = zabSubscriptionItemSearchResult[x].getText({name: 'item', summary: 'GROUP'});
            let quantity = zabSubscriptionItemSearchResult[x].getValue({name: 'quantity', summary: 'SUM',});
            let usageRate = zabSubscriptionItemSearchResult[x].getValue({name: 'amount', summary: 'MAX',});
            let itemDescription = zabSubscriptionItemSearchResult[x].getValue({name: 'memo', summary: 'MAX'});

            let itemStartDate = format.parse({
                value: minimumDate,
                type: format.Type.DATE
            });

            let itemEndDate = format.parse({
                value: this.addMonthsAndOffset({date: itemStartDate, months: 36, daysToSubtract: 1}),
                type: format.Type.DATE
            });


            return {
                chargeSchedule: frequency,
                endDate: itemEndDate,
                item: item,
                usageRate: usageRate,
                quantity: quantity,
                startDate: itemStartDate,
                subscriptionId: subscriptionId,
                itemName: itemName,
                prorationType: doNotProrate,
                itemDescription: itemDescription,

            };
        }

        /**
         *
         * Function to create the ZAB Subscription Item
         *
         */
        exports.createZABSubscriptionItem = function(context){
            log.debug('createZABSubscriptionItem',context);
            let subscriptionItemId = '';
            let zSubItemRec = record.create({type: 'customrecordzab_subscription_item', isDynamic: true});
            zSubItemRec.setValue({fieldId: 'custrecordzab_si_bill_to_customer', value: context.billToCustomers});
            zSubItemRec.setValue({fieldId: 'custrecordzab_si_end_date', value: new Date(context.endDate)});
            zSubItemRec.setValue({fieldId: 'custrecordzab_si_item', value: context.item});
            zSubItemRec.setValue({fieldId: 'custrecordzab_si_overage_rate', value: context.usageRate});
            zSubItemRec.setValue({fieldId: 'custrecordzab_si_start_date', value: new Date(context.startDate)});
            zSubItemRec.setValue({fieldId: 'custrecordzab_si_subscription', value: context.subscriptionId});
            zSubItemRec.setValue({fieldId: 'externalid', value: context.externalId});
            zSubItemRec.setValue({fieldId: 'name', value: context.itemName});
            zSubItemRec.setValue({fieldId: 'custrecordzab_si_proration_type', value: context.prorationType});
            zSubItemRec.setValue({fieldId: 'custrecordzab_si_charge_schedule', value: context.chargeSchedule});
            //START - 1.1 - JT
            zSubItemRec.setValue({fieldId: 'custrecordzab_si_item_description', value: context.itemDescription});
            //END - 1.1 - JT


            subscriptionItemId = zSubItemRec.save({
                ignoreMandatoryFields: true
            });
            log.debug('subscriptionItemId',{subscriptionItemId});
            return subscriptionItemId;
        }

        return exports
    });
