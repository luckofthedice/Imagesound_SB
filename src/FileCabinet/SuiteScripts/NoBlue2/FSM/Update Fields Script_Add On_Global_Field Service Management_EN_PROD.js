/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 *
 * Original Author: Aidan Jessen (aidanj@nexttechnik.com)
 * Contributors: Aidan J (aidanj@nexttechnik.com)
 * Last Modified: 14/11/2022 by Aidan J
 *
 * The RECORD_FIELD_MAP array at the top of the file is used to define a series of updates that need to be made to records in the system when
 * this user event script is triggered.
 *
 * For each object in the RECORD_FIELD_MAP the system will attempt to take a value from the source record (the current record) and save it into
 * a field of a target record. The id of the target record must be stored on a field on the current record (this field is set using the
 * sourceRecordAndFields.fieldIdOfTargetRecord property).
 *
 * This same script can be deployed to many different records, it will only take action if the current record's type matches the sourceRecordAndFields.recordType
 * property of one of the field map objects in the RECORD_FIELD_MAP array.
 *
 * This script will only take action if the source field value has changed and if the fieldIdOfTargetRecord field has a value.
 *
 * This script will only take action if the current context matches a valid context for the corresponding update in the RECORD_FIELD_MAP array.
 *
 * Each update can be set to either clobber or not-clobber existing values using the 'clobber' property.
 * 
 * Each update can be set to overwrite the existing value with an empty value (default) OR avoid overwriting the value if the new value would be empty.
 *
 * Multiple submissions to the same record will be completed in one single call to record.submitFields.
 */
 define(['N/record', 'N/search'], function(record, search) {
 
    // A map of source fields from the current record through to target fields on another record
    const RECORD_FIELD_MAP = [{
        sourceRecordAndFields: { recordType: 'salesorder', fieldId: 'internalid', fieldIdOfTargetRecord: 'custbody_nx_case' },
        targetRecordAndFields: { recordType: 'supportcase', fieldId: 'custevent_nx_case_transaction' },
        contexts: ['create','transform','edit'],
        clobber: false,
	    dontClear: false // if true, do not overwrite the target record value with an empty value
    }];
 
    function afterSubmit(context) {
 
        try {
 
            var newRec = context.newRecord;
            var oldRec = context.oldRecord;
            var recType = newRec.type;
 
            log.debug('afterSubmit', 'on ' + context.type)
 
            // Filter down to field maps that relate to the current record type
            var fieldMaps = getRecordFieldMaps(RECORD_FIELD_MAP, recType);
 
            // Abort if this record type doesn't trigger any updates
            if ( !fieldMaps.length ) {
                log.debug('afterSubmit', 'No target records listed for this record type.')
                return;
            }
 
            // Filter down to field maps that relate to the current context
            fieldMaps = getContextFieldMaps(fieldMaps, context.type);
 
            // Abort if this context type doesn't trigger any updates
            if ( !fieldMaps.length ) {
                log.debug('afterSubmit', 'Invalid context for changes to this record type.')
                return;
            }
 
            // record updates to make
            var submissions = {};
 
            fieldMaps.filter(function(map) {
                // Only trigger if the value of the source field or target field has changed
                return valueHasChanged(oldRec, newRec, map.sourceRecordAndFields.fieldId) || valueHasChanged(oldRec, newRec, map.sourceRecordAndFields.fieldIdOfTargetRecord);
            }).filter(function(map) {
                // Only trigger if the target record is entered on the current record
                return hasValue(newRec, map.sourceRecordAndFields.fieldIdOfTargetRecord);
            }).filter(function(map) {
                // If the dontClear option is set, only trigger if the source field has a value
		        if (map.dontClear) return hasValue(newRec, map.sourceRecordAndFields.fieldId);
		        return true;
            }).filter(function(map) {
                // Only trigger if the target can be clobbered or if it doesn't already have a value
                return map.clobber || (
                    isNull( getSelectResult( search.lookupFields({
                        type: map.targetRecordAndFields.recordType,
                        id: getValue(newRec, map.sourceRecordAndFields.fieldIdOfTargetRecord),
                        columns: [map.targetRecordAndFields.fieldId]
                    }), map.targetRecordAndFields.fieldId, 'value' ) )
                );
            }).forEach(function(map) {
                // Get the target id and add the submission to the corresponding values to submit object for that target record
                var targetKey = map.targetRecordAndFields.recordType + '-' + getValue(newRec, map.sourceRecordAndFields.fieldIdOfTargetRecord);
                if ( submissions[targetKey] == undefined ) submissions[targetKey] = {};
                submissions[targetKey][map.targetRecordAndFields.fieldId] = getValue(newRec, map.sourceRecordAndFields.fieldId);
            });
 
            log.debug('afterSubmit | submissions', JSON.stringify(submissions));
 
            // make submissions
            Object.keys(submissions).forEach(function(targetKey) {
                var targetDetails = splitTargetKey(targetKey);
                record.submitFields({
                    type: targetDetails.targetType,
                    id: targetDetails.targetId,
                    values: submissions[targetKey]
                });
                log.audit('afterSubmit | targetType-targetId', 'Updated: ' + targetKey)
            });
 
        } catch(e) {
            log.error('afterSubmit | error', JSON.stringify(e));
        }
 
    } // end afterSubmit
 
    function getContextFieldMaps(mapArr, contextType) {
        return mapArr.filter(function(map) {
            return map.contexts.indexOf(contextType) != -1;
        });
    } // end getContextFieldMap
 
    function getRecordFieldMaps(mapArr, recType) {
        return mapArr.filter(function(map) {
            return map.sourceRecordAndFields.recordType == recType;
        });
    } // end getRecordFieldMap
 
    function getValue(rec, fieldId) {
        if ( fieldId == 'internalid' ) return rec.id;
        return rec.getValue({fieldId: fieldId});
    } // end getValue
 
    function hasValue(rec, fieldId) {
        return !!getValue(rec, fieldId);
    } // end hasValue
 
    function valueHasChanged(oldRec, newRec, fieldId) {
        log.debug('valueHasChanged | fieldId', fieldId);
        var oldVal = oldRec && getValue(oldRec, fieldId);
        log.debug('valueHasChanged | oldVal', oldVal);
        var newVal = newRec && getValue(newRec, fieldId);
        log.debug('valueHasChanged | newVal', newVal);
        return newVal != oldVal;
    } // valueHasChanged
 
    function splitTargetKey(targetKey) {
        var targetKeyArr = targetKey.split('-');
        if ( targetKeyArr.length < 2 ) return null;
        return { targetType: targetKeyArr[0], targetId: targetKeyArr[1] };
    } // endSplitTargetKey
 
    function getSelectResult(results, fieldId, type) {
        return results[fieldId] && results[fieldId][0] && results[fieldId][0][type];
    } // end getSelectResult
 
    function isNull(value) {
        return value === undefined || value === null || value === '';
    } // end isNull
 
    return {
        afterSubmit: afterSubmit,
    };
});