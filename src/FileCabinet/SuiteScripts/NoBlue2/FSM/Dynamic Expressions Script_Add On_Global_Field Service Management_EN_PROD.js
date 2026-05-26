/**
 * A basic null test. 
 * @param {*} value The value to check.
 * @param {*} [emptyArrayIsNull] Specifies if an empty array should be considered as null (default = true).
 * @returns {Boolean} True if the provided value is null, undefined, an empty string or an empty array.
 */
function isNull(value, emptyArrayIsNull = true) {
	return value === null || value === '' || value === undefined || (emptyArrayIsNull && Array.isArray(value) && value.length == 0);
} // end isNull

/**
 * Example uses of nxc_compare
 * 
 * nxc_compare(textfield.value, 'text', 'empty')
 * nxc_compare(textfield.value, 'text', 'notempty')
 * nxc_compare(textfield.value, 'text', 'contains', 'test')
 * nxc_compare(textfield.value, 'text', 'doesnotcontain', 'test')
 * 
 * nxc_compare(selectfield.value, 'select', 'empty')
 * nxc_compare(selectfield.value, 'select', 'notempty')
 * nxc_compare(selectfield.value, 'select', 'anyof', '1')
 * nxc_compare(selectfield.value, 'select', 'noneof', ['1','2'])
 * 
 * nxc_compare(multiselectfield.value, 'multiselect', 'empty')
 * nxc_compare(multiselectfield.value, 'multiselect', 'notempty')
 * nxc_compare(multiselectfield.value, 'multiselect', 'anyof', 'empty', '1')
 * nxc_compare(multiselectfield.value, 'multiselect', 'noneof', 'empty', ['1','2'])
 * nxc_compare(multiselectfield.value, 'multiselect', 'allof', 'empty', ['1','2'])
 */

/**
 * Compares the value of a property of a field 
 * @param {Object} field The field who's property should be compared.
 * @param {String} condition The condition to be used when comparing the value of the field's property.
 * @param {Array} [value] The value(s) to compare the property against.
 * @returns {Boolean} The result of the comparison.
 */
function nxc_compare(propValue, propType, condition, compValue) {
	// Check required fields
	const signature = 'nxc_compare(propValue, propType, condition, compValue)';
	if (isNull(propType)) throw new Error(signature + ' - please define the type of value provided (missing propType).');
	if (isNull(condition)) throw new Error(signature + ' - please provide a comparison condition (missing condition).');

	// Check valid conditions & field types
	const validConditions = {
		'select': ['anyof','noneof','empty','notempty'],
		'value': ['anyof','noneof','empty','notempty'],
		'text': ['empty', 'notempty', 'contains', 'doesnotcontain'],
		'textarea': ['empty', 'notempty', 'contains', 'doesnotcontain'],
		'multiselect': ['anyof','allof','noneof','empty','notempty'],
		'array': ['anyof','allof','noneof','empty','notempty']
	};
	const validFieldTypes = Object.keys(validConditions);
	if (!~validFieldTypes.indexOf(propType)) throw new Error(signature + ' - invalid field type ' + propType + '. Valid field types are: ' + validFieldTypes);
	if (!~validConditions[propType].indexOf(condition)) throw new Error(signature + ' - invalid condition ' + condition + ', for field type ' + propType + '. Valid conditions are: ' + validConditions[propType]);

	// Check for comparison value if one is needed
	const conditionsRequiringComparison = ['anyof','noneof'];
	if (isNull(compValue) && ~conditionsRequiringComparison.indexOf(condition)) throw new Error(signature + ' - comparison value(s) (compValue) required for this condition: ' + condition + '.');

	// Adjust value based on field type
	if (propType == 'select') propValue = propValue && propValue.id;
	if (propType == 'multiselect') propValue = propValue.map(o => o.id);

	// Convert comparison value to an array if required
	if (!~['text', 'textarea'].indexOf(propType) && !Array.isArray(compValue)) compValue = [compValue];

	// Return comparison result
	if (propType != 'multiselect' && propType != 'array') {
		// For standard field types
		switch (condition) {
			case 'anyof':
				return !!propValue && !!~compValue.map(o => o.toString()).indexOf(propValue.toString());
			case 'noneof':
				return !propValue || !~compValue.map(o => o.toString()).indexOf(propValue.toString());
			case 'empty':
				return isNull(propValue);
			case 'notempty':
				return !isNull(propValue);
			case 'contains':
				return !isNull(propValue) && propValue.toString().includes(compValue.toString());
			case 'doesnotcontain':
				return isNull(propValue) || !propValue.toString().includes(compValue.toString());
			default:
				throw new Error(signature + ' - the provided condition (' + condition + ') is not yet supported.');
		}
	} else {
		// For multiselect & array properties
		switch (condition) {
			case 'anyof':
				return !isNull(propValue) && compValue.map(o => o.toString()).reduce((hide, id) => hide || propValue.map(o => o.toString()).indexOf(id) != -1, false);
			case 'noneof':
				return isNull(propValue) || !compValue.map(o => o.toString()).reduce((hide, id) => hide || propValue.map(o => o.toString()).indexOf(id) != -1, false);
			case 'allof':
				return !isNull(propValue) && !compValue.map(o => o.toString()).reduce((hide, id) => hide || propValue.map(o => o.toString()).indexOf(id) == -1, false);
			case 'empty':
				return isNull(propValue);
			case 'notempty':
				return !isNull(propValue);
			default:
				throw new Error(signature + ' - the provided condition (' + condition + ') is not yet supported.');
		}
	}
} // end nxc_compare

/**
 * Example uses of nxc_source
 * 
 * nxc_source(value, options, property)
 * 
 * nxc_source(selectfield.value, selectfield.options)
 * nxc_source(selectfield.value, selectfield.options, 'billable')
 */

/**
 * Returns a specific property from a select/multi-select field's list of options.
 * @param {Object} value The value currently selected within the select field of the form {id: [internalid], label: [string]}
 * @param {Array} options The list of all options available within the select field.
 * @param {String} [property] The specific property to be sourced from the currently selected value. Default is 'label'
 * @returns {*} The value stored within the property of the currently selected option.
 */
function nxc_source(value, options, property = 'label') {
	const signature = 'nxc_source(value, options, property)';
	if (isNull(options, false)) throw new Error(signature + ' - No options provided.')

	// Return null if no value has yet been selected
	if (isNull(value)) return null;

	let fullValue = options.find(o => o.id == value.id);

	return !isNull(fullValue) ? fullValue[property] : null;
} // end nxc_source

/**
 * Example uses of nxc_filter
 * 
 * nxc_filter(optionsToFilter, propertyToFilterOn, valueToFilterBy, propertyToFilterBy, optionsToFilterBy)
 * 
 * nxc_filter(selectfield1.options, 'compval', selectfield2.value)
 * nxc_filter(selectfield1.options, 'compval', selectfield2.value, 'compval', selectfield2.options,)
 */

/**
 * Filters a list of select/multiselect field options according to a selection made in another select field.
 * @param {Array} optionsToFilter An array of select/multi-select options to filter down.
 * @param {String} propertyToFilterOn The property (from the other select field's value) that is to be used to filter the options (default is 'id').
 * @param {Object} valueToFilterBy The value of the other select field that is to be used to filter the options.
 * @param {String} [propertyToFilterBy] The property (from the other select field's value) that is to be used to filter the original options (default is 'id').
 * @param {Array} [optionsToFilterBy] The options available to the other select field. Only needed if filtering by an alternative property.
 * @returns {Array} An array of options filtered according to the value provided, or an empty array if no value has yet been provided.
 */
function nxc_filter(optionsToFilter, propertyToFilterOn, valueToFilterBy, propertyToFilterBy = 'id', optionsToFilterBy) {
	console.log('optionsToFilter: ' + JSON.stringify(optionsToFilter));
	console.log('propertyToFilterOn: ' + propertyToFilterOn);
	console.log('valueToFilterBy: ' + JSON.stringify(valueToFilterBy));
	console.log('propertyToFilterBy: ' + propertyToFilterBy);
	console.log('optionsToFilterBy: ' + JSON.stringify(optionsToFilterBy));
	const signature = 'nxc_filter(optionsToFilter, propertyToFilterOn, valueToFilterBy, propertyToFilterBy, optionsToFilterBy)';
	if (isNull(optionsToFilter, false)) throw new Error(signature + ' - No optionsToFilter provided.')
	if (isNull(propertyToFilterOn)) throw new Error(signature + ' - No propertyToFilterOn provided.')

	let standardProperties = ['id', 'label'];
	let filterByStandardProperty = !!~standardProperties.indexOf(propertyToFilterBy);
	if (!filterByStandardProperty && isNull(optionsToFilterBy, false)) throw new Error(signature + ' - No optionsToFilterBy provided. optionsToFilterBy is required when filtering by a non-standard property.')

	// Return an empty array if no value has yet been selected
	if (isNull(valueToFilterBy)) return [];

	console.log('filterByStandardProperty: ' + filterByStandardProperty);
	let filterValue = filterByStandardProperty ? valueToFilterBy[propertyToFilterBy] : optionsToFilterBy.find(o => o.id == valueToFilterBy.id)[propertyToFilterBy];
	console.log('filterValue: ' + filterValue);
	if(typeof (propertyToFilterOn) =='object' ) {
		return optionsToFilter.filter(o => o[propertyToFilterOn].indexOf(filterValue) != -1);
	}
	else{
		return optionsToFilter.filter(o => o[propertyToFilterOn] == filterValue);
	}
} // end nxc_filter

/**
 * Example uses of nxc_now
 * 
 * nxc_now('date')
 * nxc_now('datetime')
 * nxc_now()
 */

/**
 * Returns the current date/time as a string or NULL if the trigger value provided is empty. 
 * @param {String} [type] The type of time/date stamp to be returned (default = 'datetime').
 * @param {*} [trigger] A field value to be used to trigger the setting of the time/date stamp. If none is provided a time/date stamp is always returned.
 * @returns A time/date stamp string.
 */
function nxc_now(type = 'datetime', trigger) {
	const signature = 'nxc_now(type)';
	// Check that a valid type has been provided
	const validTypes = ['time', 'date', 'datetime'];
	if (!~validTypes.indexOf(type)) throw new Error(signature + ' - invalid type provided, ' + type + '. Valid types are: ' + validTypes);

	// If a trigger field value has been provided & that value is empty, don't return a time/date stamp
	if (trigger != undefined && isNull(trigger)) return null;

	var today = new Date();
	var time = ('0' + today.getHours()).slice(-2) + ':' + ('0' + today.getMinutes()).slice(-2);
	var date = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);

	switch(type) {
		case 'time': 
			return time;
		case 'date':
			return date;
		case 'datetime':
			return date + 'T' + time;
		default:
			throw new Error(signature + ' - the provided type (' + type + ') is not yet supported.');
	}
} // end nxc_now

/**
 * Example uses of nxc_decode
 * 
 * nxc_decode(assettype.value, 1, 'one', 2, 'two', 3, 'three', 'default')
 * nxc_decode(assettype.value, 1, 117, 2, 112, 3, 115)
 */

/**
 * Decodes a provided value following the rules for value/result provided. 
 * @param {*} value The value to be decoded.
 * @param  {...any} args A series of arguments e.g. value1, result1, value2, result2, ... fallback
 * @returns The result that matches the provided value, or the fallback result if no match is found, or null if no match is found and no fallback is provided.
 */
function nxc_decode(value, ...args) {
	const signature = 'nxc_decode(value, val1, result1, val2, result2, ..., fallback)';
	if ( args.length == 0 ) throw new Error(signature + ' - not enough arguments.');

	var numOfTests = Math.floor(args.length / 2);
	for (var i = 0; i < numOfTests; i++) {
		if (value == args[2*i]) return args[2*i + 1];
	}

	return !(args.length % 2) ? null : args[args.length - 1];
} // end nxc_decode

/**
 * Example uses of nxc_timediff
 * 
 * nxc_timediff(start.value, end.value)
 * nxc_timediff(start.value, end.value, 30, 2)
 */

/**
 * Returns the number of hours between two timestamps. 
 * @param {String} timea The first timestamp represented in a string in the format 'HH:MM' (24 Hour time).
 * @param {String} timeb The second timestamp represented in a string in the format 'HH:MM' (24 Hour time).
 * @param {Integer} [round] The number of minutes up to which the difference should be rounded (default 15).
 * @param {Integer} [precision] The number of decimal points to return in the result (default 3).
 * @returns {String} A string representing the decimal number of hours between the two provided timestamps.
 */
function nxc_timediff(timea, timeb, round = 15, precision = 3) {
	if (isNull(timea)) return null;
	if (isNull(timeb)) return null;

	var arrA = timea.split(':');
	var totalMinsA = Number(arrA[1]) + 60 * Number(arrA[0]);

	var arrB = timeb.split(':');
	var totalMinsB = Number(arrB[1]) + 60 * Number(arrB[0]);

	var inv = 1/Number(round);
	var result = Math.ceil((totalMinsB - totalMinsA)*inv)/inv;

	return (result/60).toFixed(Number(precision));
} // end nxc_timediff
/**
 * Returns the number of hours between two datetimestamps. 
 * @param {String} datetimea The first datetimestamp represented in a string in the format 'HH:MM' (24 Hour time).
 * @param {String} datetimeb The second datetimestamp represented in a string in the format 'HH:MM' (24 Hour time).
 * @param {Integer} [round] The number of minutes up to which the difference should be rounded (default 15).
 * @param {Integer} [precision] The number of decimal points to return in the result (default 3).
 * @returns {String} A string representing the decimal number of hours between the two provided date timestamps.
 */
function nxc_diff_hours(datetime1,datetime2, round = 15, precision = 3) 
 {
	if (isNull(datetime1)) return null;
	if (isNull(datetime2)) return null;

	dt1 = new Date(datetime1);
	dt2 = new Date(datetime2);
    var diff =(dt2.getTime() - dt1.getTime()) / 1000;
    diff /= (60*60);
	diffinmin=diff*60
   var inv = 1/Number(round);
   var result = Math.ceil(diffinmin*inv)/inv;

   return (result/60).toFixed(Number(precision)); 
    //return (diff).toFixed(Number(precision));  
 }
// Export functions for testing via Jest
if ( typeof module !== 'undefined' ) {
	module.exports = {
		nxc_compare: nxc_compare,
		nxc_source: nxc_source,
		nxc_filter: nxc_filter,
		nxc_now: nxc_now,
		nxc_decode: nxc_decode,
		nxc_timediff: nxc_timediff,
        nxc_diff_hours:nxc_diff_hours
	};
}