/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/url', 'N/log'], (record, search, runtime, url, log) => {

    const ROOT_FOLDER_ID = 4037;
    const INSTALLATION_PROJECT_ID = 16; 

    const beforeLoad = (scriptContext) => {
        if (scriptContext.type !== scriptContext.UserEventType.VIEW) return;
        const newRec = scriptContext.newRecord;
        if (newRec.getValue('custentity_nx_project_type') != INSTALLATION_PROJECT_ID) return;

        const folderId = newRec.getValue('custentity_ims_prj_folder');
        if (folderId) {
            scriptContext.form.clientScriptModulePath = './IMS_CS_ProjectProject.js';
            scriptContext.form.addButton({
                id: 'custpage_upload_btn',
                label: 'Upload Project File',
                functionName: `openUploadSuitelet(${folderId})`
            });
        }
    };

    const afterSubmit = (scriptContext) => {
        if (scriptContext.type === scriptContext.UserEventType.DELETE) return;

        const newRec = scriptContext.newRecord;
        if (newRec.getValue('custentity_nx_project_type') != INSTALLATION_PROJECT_ID) return;

        const projName = newRec.getValue('custentity_ims_internal_project_name');
        const customerId = newRec.getValue('custentity_nx_customer');

        // GUARD: If Project Name or Customer is missing, exit.
        if (!projName || !customerId) {
            log.audit('Data Missing', 'Internal Project Name or Customer is empty.');
            return;
        }

        try {
            const customerLookup = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: customerId,
                columns: ['custentity_nb2_ch_brand']
            });

            let brandName = '';
            if (customerLookup.custentity_nb2_ch_brand && customerLookup.custentity_nb2_ch_brand.length > 0) {
                brandName = customerLookup.custentity_nb2_ch_brand[0].text;
            } else {
                brandName = customerLookup.custentity_nb2_ch_brand;
            }

            // GUARD: If Brand is missing, exit.
            if (!brandName) {
                log.audit('Brand Missing', `Customer ID ${customerId} has no Brand value.`);
                return;
            }

            // Execute Folder Logic
            const brandFolderId = getOrCreateFolder(brandName, ROOT_FOLDER_ID);
            const finalProjFolderId = getOrCreateFolder(projName, brandFolderId);

            // Update Project Record
            const accountId = runtime.accountId.replace('_', '-').toLowerCase();
            const folderUrl = `https://${accountId}.app.netsuite.com/app/common/media/mediaitemlist.nl?folder=${finalProjFolderId}`;

            record.submitFields({
                type: newRec.type,
                id: newRec.id,
                values: {
                    'custentity_ims_prj_folder': finalProjFolderId,
                    'custentity_ims_folder_url': folderUrl
                }
            });

        } catch (e) {
            log.error('afterSubmit Error', e.message);
        }
    };

    const getOrCreateFolder = (folderName, parentId) => {
        // Double Check: Ensure folderName is a string and not empty
        if (!folderName || folderName.toString().trim() === '') {
            throw new Error('Folder name provided is empty.');
        }

        const cleanName = folderName.toString().replace(/[:\\\/|*?"<>]/g, '-').trim();

        const folderSearch = search.create({
            type: search.Type.FOLDER,
            filters: [
                search.createFilter({ name: 'name', operator: search.Operator.IS, values: cleanName }),
                search.createFilter({ name: 'parent', operator: search.Operator.ANYOF, values: parentId })
            ]
        }).run().getRange({ start: 0, end: 1 });

        if (folderSearch && folderSearch.length > 0) {
            return folderSearch[0].id;
        } else {
            const folderRec = record.create({ type: record.Type.FOLDER });
            folderRec.setValue('name', cleanName);
            folderRec.setValue('parent', parentId);
            return folderRec.save();
        }
    };

    return { beforeLoad, afterSubmit };
});