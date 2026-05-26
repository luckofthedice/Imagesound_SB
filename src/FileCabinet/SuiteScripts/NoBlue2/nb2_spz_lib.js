/**
 * @NApiVersion 2.1
 */
define(['N/record', 'N/search', 'N/format'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, format) => {

        const createSPZ = (zcId, zsId, itemId, serviceStart, serviceEnd, chargeAmount, chargeDescription, invoiceId) => {
            const spzRec = record.create({type: 'customrecord_nb2_spz_impact'});
            spzRec.setValue({fieldId: 'custrecord_nb2_spz_source_zc', value: zcId});
            spzRec.setValue({fieldId: 'custrecord_nb2_spz_sourcesub', value: zsId});
            spzRec.setValue({fieldId: 'custrecord_nb2_spz_invoice', value: invoiceId});

            const zoneDataArr = getZonesFromRatingData(zsId, itemId, serviceStart, serviceEnd, chargeAmount, chargeDescription);

            const daysBetween = (start, end) => {
                const msPerDay = 1000 * 60 * 60 * 24;
                const startDate = new Date(start);
                const endDate = new Date(end);
                return Math.round((endDate - startDate) / msPerDay) + 1; // +1 for inclusive
            };

            for (let i = 0; i < zoneDataArr.length; i++) {
                let zoneObj = zoneDataArr[i];
                const setLine = (fieldId, value) => spzRec.setSublistValue({ sublistId: 'recmachcustrecord_nb2_spzz_parent', fieldId, line: i, value });
                const toDate = (val) => val instanceof Date ? val : format.parse({ type: format.Type.DATE, value: val });

                const parsedServiceStart  = toDate(serviceStart);
                const parsedServiceEnd    = toDate(serviceEnd);
                const parsedZoneStart     = toDate(zoneObj.startDate);
                const parsedZoneEnd= zoneObj.endDate ? toDate(zoneObj.endDate) : null;

                const zoneStartIsLater  = parsedServiceStart >= parsedZoneStart;
                const zoneEndIsEarlier  = parsedZoneEnd && parsedZoneEnd < parsedServiceEnd;

                const startDate = zoneStartIsLater ? parsedServiceStart : parsedZoneStart;
                const endDate   = zoneEndIsEarlier ? parsedZoneEnd      : parsedServiceEnd;

                const zoneQty = zoneStartIsLater || zoneEndIsEarlier
                    ? parseFloat((daysBetween(startDate, endDate) / daysBetween(parsedServiceStart, parsedServiceEnd)).toFixed(4))
                    : 1;

                setLine('custrecord_nb2_spzz_customer', zoneObj.customer);
                setLine('custrecord_nb2_spzz_site',     zoneObj.site);
                setLine('custrecord_nb2_spzz_player',   zoneObj.player);
                setLine('custrecord_nb2_spzz_zone',     zoneObj.zone);
                setLine('custrecord_nb2_spzz_amount',   chargeAmount * zoneQty);
                setLine('custrecord_nb2_spzz_startdate',      startDate);
                setLine('custrecord_nb2_spzz_enddate',        endDate);
                setLine('custrecord_nb2_spzz_item',           itemId);
                setLine('custrecord_nb2_spzz_clienttype',     zoneObj.clienttype);
                setLine('custrecord_nb2_spzz_audiopackage',   zoneObj.audiopackage);
                setLine('custrecord_nb2_spzz_musiccontenttype', zoneObj.musiccontenttype);
                setLine('custrecord_nb2_spzz_rentsold',       zoneObj.rentsold);
                setLine('custrecord_nb2_spzz_physicalonline', zoneObj.physicalonline);
                setLine('custrecord_nb2_spzz_videopackage',   zoneObj.videopackage);
                setLine('custrecord_nb2_spzz_salesdesc',      zoneObj.memo);
                setLine('custrecord_nb2_spzz_sourcequote',    zoneObj.quote);
                setLine('custrecord_nb2_spzz_quantity',       zoneQty);
            }

            let newRecId = spzRec.save();
            return newRecId;

        }

        const getZonesFromRatingData = (subId, itemId, startDate, endDate, rate, chargeDescription) => {
            /** @NApiVersion 2.1 */
            const transactionSearchObj = search.create({
                type: "transaction",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters:
                    [
                        ["type","anyof","Estimate","Opprtnty"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["custbody_nb2_quote_approval_status","anyof","2"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["cogs","is","F"],
                        "AND",
                        ["item.isinactive","is","F"],
                        "AND",
                        ["custbody_nb2_zab_subscription_link","anyof",subId],
                        "AND",
                        ["item","anyof",itemId],
                        "AND",
                        ["formulatext: LOWER({memo})","is",chargeDescription.toLowerCase()],
                        "AND",
                        ["fxamount","equalto",rate],
                        "AND",
                        ["custcol_nb2_contract_startdate","onorbefore",format.format({value: endDate, type: format.Type.DATE})],
                        "AND",
                        [["custcol_nb2_contract_enddate","onorafter",format.format({value: startDate, type: format.Type.DATE})],"OR",["custcol_nb2_contract_enddate","isempty",""]]
                    ],
                columns:
                    [
                        "internalid",
                        "custcol_nb2_zone",
                        "custcol_nb2_player",
                        "custcol_nb2_ch_sit_quo",
                        "name",
                        "custcol_nb2_cli_typ",
                        "custcol_nb2_aud_pac",
                        "custcol_nb2_mus_con",
                        "custcol_nb2_ren_sol",
                        "custcol_nb2_phy_onl",
                        "custcol_nb2_video_package",
                        "memo",
                        "custcol_nb2_contract_startdate",
                        "custcol_nb2_contract_enddate"
                    ]
            });

            return runSearchAndReturn(transactionSearchObj);

        }

        const runSearchAndReturn = (searchObj) => {
            let searchPageSize =  1000;
            let searchPageNumber = 0

            let savedSearchPageData = searchObj.runPaged({pageSize: searchPageSize});
            let savedSearchPageCount = savedSearchPageData.pageRanges.length;

            let zoneArr = [];

            while (savedSearchPageCount > searchPageNumber) {
                let savedSearchPage = savedSearchPageData.fetch({index: searchPageNumber});

                savedSearchPage.data.forEach(function (result) {
                    let zoneObj = {
                        quote:result.getValue({name: 'internalid'}),
                        zone:result.getValue({name: 'custcol_nb2_zone'}),
                        player:result.getValue({name: 'custcol_nb2_player'}),
                        site:result.getValue({name: 'custcol_nb2_ch_sit_quo'}),
                        customer:result.getValue({name: 'name'}),
                        clienttype:result.getValue({name: 'custcol_nb2_cli_typ'}),
                        audiopackage:result.getValue({name: 'custcol_nb2_aud_pac'}),
                        musiccontenttype:result.getValue({name: 'custcol_nb2_mus_con'}),
                        rentsold:result.getValue({name: 'custcol_nb2_ren_sol'}),
                        physicalonline:result.getValue({name: 'custcol_nb2_phy_onl'}),
                        videopackage:result.getValue({name: 'custcol_nb2_video_package'}),
                        memo:result.getValue({name: 'memo'}),
                        startDate:result.getValue({name: 'custcol_nb2_contract_startdate'}),
                        endDate:result.getValue({name: 'custcol_nb2_contract_enddate'})
                    }
                    zoneArr.push(zoneObj);
                })

                searchPageNumber += 1;
            }

            return zoneArr;
        }

        return {createSPZ}

    });