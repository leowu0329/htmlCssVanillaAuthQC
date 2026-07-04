// pages/ipqc/ipqc.js
import { getSupabase } from '../../core/db.js';
import { ModalComponent } from '../../features/modal.js';
import { FormatUtility } from '../../utils/utils.js';

// 主模組變數狀態
let mainData = [];
let filteredData = [];
let mainPage = 1;
const mainPageSize = 10;

// 子模組變數狀態
let subCurrentTable = ''; // 'defect_list', 'order_list', 'operator_list', 'spec_list'
let subData = [];
let subFilteredData = [];
let subPage = 1;
const subPageSize = 10;
let subFormMode = 'add';

// Bootstrap Modal 實例容器
let bsMainModal = null;
let bsSubModal = null;
let bsConfirmModal = null;
let confirmCallback = null;

export async function init() {
    console.log("IPQC 工作台初始化開始...");
    
    // 初始化對應的所有 Modal 實例
    bsMainModal = new bootstrap.Modal(document.getElementById('ipqcCrudModal'));
    bsSubModal = new bootstrap.Modal(document.getElementById('subManagerModal'));
    bsConfirmModal = new bootstrap.Modal(document.getElementById('ipqcConfirmModal'));

    // 動態預加載 SheetJS CDN 以處理 Excel 匯入出
    if (!window.XLSX) {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
        document.head.appendChild(script);
    }

    // 綁定主工作台事件監聽
    document.getElementById('main-search').addEventListener('input', doMainSearch);
    document.getElementById('main-date-start').addEventListener('change', doMainSearch);
    document.getElementById('main-date-end').addEventListener('change', doMainSearch);
    document.getElementById('btn-main-add').addEventListener('click', () => openMainCrud('add'));
    document.getElementById('btn-main-export').addEventListener('click', exportMainExcel);
    document.getElementById('main-excel-file').addEventListener('change', (e) => importExcel(e, 'main'));

    // 綁定主表單提交與自動補全
    document.getElementById('ipqc-crud-form').addEventListener('submit', handleMainSubmit);
    setupOrderAutocomplete();

    // 綁定子表快捷開啟按鈕 (+) 包含全新的規格版本維護按鈕
    document.getElementById('btn-sub-defect-mgr').addEventListener('click', () => openSubManager('defect_list'));
    document.getElementById('btn-sub-order-mgr').addEventListener('click', () => openSubManager('order_list'));
    document.getElementById('btn-sub-operator-mgr').addEventListener('click', () => openSubManager('operator_list'));
    document.getElementById('btn-sub-spec-mgr').addEventListener('click', () => openSubManager('spec_list'));

    // 綁定子工作台內部事件
    document.getElementById('sub-search').addEventListener('input', doSubSearch);
    document.getElementById('btn-sub-add-form').addEventListener('click', toggleSubFormAdd);
    document.getElementById('btn-sub-form-cancel').addEventListener('click', () => document.getElementById('sub-data-form').classList.add('d-none'));
    document.getElementById('sub-data-form').addEventListener('submit', handleSubSubmit);
    document.getElementById('btn-sub-export').addEventListener('click', exportSubExcel);
    document.getElementById('sub-excel-file').addEventListener('change', (e) => importExcel(e, 'sub'));

    // 綁定刪除二次確認執行器
    document.getElementById('btn-confirm-execute').addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        bsConfirmModal.hide();
    });

    // 執行初始化異步資料加載
    await Promise.all([
        fetchMainRecords(),
        loadDropdownOptions()
    ]);
}

/**
 * 彈窗二次詢問封裝元件
 */
function askConfirmation(message, onConfirm) {
    document.getElementById('confirmModalBodyText').innerText = message;
    confirmCallback = onConfirm;
    bsConfirmModal.show();
}

/**
 * 撈取 ipqc_list 所有欄位資料
 */
async function fetchMainRecords() {
    const tbody = document.getElementById('ipqc-main-tbody');
    try {
        const supabase = await getSupabase();
        if (!supabase) return;

        const { data, error } = await supabase
            .from('ipqc_list')
            .select('*')
            .order('date', { ascending: false })
            .order('time', { ascending: false });

        if (error) throw error;
        mainData = data || [];
        doMainSearch();

    } catch (err) {
        console.error("讀取資料失敗:", err);
        tbody.innerHTML = `<tr><td colspan="11" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-1"></i> 同步資料庫失敗 (${err.message})</td></tr>`;
    }
}

/**
 * 主表關鍵字與日期範圍雙向過濾
 */
function doMainSearch() {
    const keyword = document.getElementById('main-search').value.toLowerCase().trim();
    const startDate = document.getElementById('main-date-start').value;
    const endDate = document.getElementById('main-date-end').value;

    filteredData = mainData.filter(row => {
        const matchKeyword = !keyword || [
            row.order_number, row.product_number, row.product_name, row.spec, 
            row.inspector, row.determination, row.defect_classification, 
            row.defect_status, row.handling_measures, row.remark
        ].some(val => String(val || '').toLowerCase().includes(keyword));

        let matchDate = true;
        if (startDate && row.date < startDate) matchDate = false;
        if (endDate && row.date > endDate) matchDate = false;

        return matchKeyword && matchDate;
    });

    mainPage = 1;
    renderMainTable();
}

/**
 * 渲染主表 Table
 */
function renderMainTable() {
    const tbody = document.getElementById('ipqc-main-tbody');
    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted py-4">沒有符合條件的巡檢明細紀錄</td></tr>`;
        updateMainPagination(0);
        return;
    }

    const startIdx = (mainPage - 1) * mainPageSize;
    const endIdx = Math.min(startIdx + mainPageSize, filteredData.length);
    const pageData = filteredData.slice(startIdx, endIdx);

    tbody.innerHTML = pageData.map(row => {
        const isPass = row.determination === 'PASS';
        const badgeClass = isPass ? 'bg-success' : 'bg-danger';
        
        const renderTruncated = (str) => {
            const txt = str || '';
            if (txt.length > 10) {
                return `<div class="text-ellipsis-10" title="${txt.replace(/"/g, '&quot;')}">${txt.substring(0, 10)}...</div>`;
            }
            return txt;
        };

        return `
            <tr>
                <td>${row.date || ''}<br><span class="text-muted small">${row.time || ''}</span></td>
                <td class="fw-bold text-primary">${row.order_number || ''}</td>
                <td>
                    <div class="fw-medium">${row.product_number || ''}</div>
                    <div class="small text-secondary">${row.product_name || ''}</div>
                    <div class="small text-muted italic">${row.spec || ''}</div>
                </td>
                <td>${row.quantity || 0}</td>
                <td>${row.inspector || ''}</td>
                <td class="text-center"><span class="badge ${badgeClass}">${row.determination}</span></td>
                <td>${row.defect_classification || ''}</td>
                <td>${renderTruncated(row.defect_status)}</td>
                <td>${renderTruncated(row.handling_measures)}</td>
                <td>${renderTruncated(row.remark)}</td>
                <td class="text-center">
                    <button class="btn btn-xs btn-outline-dark me-1" onclick="window.editMainRecord('${row.id}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-xs btn-outline-danger" onclick="window.deleteMainRecord('${row.id}')"><i class="bi bi-trash3"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    updateMainPagination(filteredData.length, startIdx + 1, endIdx);
}

/**
 * 處理主頁碼分頁
 */
function updateMainPagination(totalCount, startRange = 0, endRange = 0) {
    const info = document.getElementById('main-pagination-info');
    info.innerText = `共 ${totalCount} 筆，第 ${totalCount > 0 ? startRange : 0}~${endRange} 筆`;

    const pagesContainer = document.getElementById('main-pagination-pages');
    pagesContainer.innerHTML = '';
    if (totalCount === 0) return;

    const totalPages = Math.ceil(totalCount / mainPageSize);
    let startP = Math.max(1, mainPage - 1);
    let endP = Math.min(totalPages, startP + 2);
    if (endP - startP < 2) startP = Math.max(1, endP - 2);

    pagesContainer.innerHTML += `<li class="page-item ${mainPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${mainPage - 1}">&laquo;</a></li>`;
    for (let i = startP; i <= endP; i++) {
        pagesContainer.innerHTML += `<li class="page-item ${mainPage === i ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
    }
    pagesContainer.innerHTML += `<li class="page-item ${mainPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${mainPage + 1}">&raquo;</a></li>`;

    pagesContainer.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const p = parseInt(e.target.getAttribute('data-page'));
            if (p >= 1 && p <= totalPages) {
                mainPage = p;
                renderMainTable();
            }
        });
    });
}

/**
 * 加載下拉選單來源
 */
async function loadDropdownOptions() {
    try {
        const supabase = await getSupabase();
        if (!supabase) return;

        const { data: opData } = await supabase.from('operator_list').select('*');
        const opSelect = document.getElementById('field-operator');
        const insSelect = document.getElementById('field-inspector');
        
        if (opData) {
            opSelect.innerHTML = opData.map(o => `<option value="${o.name}">${o.name}</option>`).join('');
            const qcOperators = opData.filter(o => o.department === '正義廠品管課');
            insSelect.innerHTML = qcOperators.map(o => `<option value="${o.name}">${o.name}</option>`).join('');
        }

        insSelect.value = "Leo Wu";

        const { data: dfData } = await supabase.from('defect_list').select('defect_type');
        const dfSelect = document.getElementById('field-defect_classification');
        if (dfData) {
            dfSelect.innerHTML = '<option value="">-- 無不良狀況 (合格) --</option>' + 
                dfData.map(d => `<option value="${d.defect_type}">${d.defect_type}</option>`).join('');
        }

    } catch (err) {
        console.error("加載對應動態下拉選單失敗:", err);
    }
}

/**
 * 製令工單自動補全與多表全自動跨表欄位代入
 */
function setupOrderAutocomplete() {
    const input = document.getElementById('field-order_number');
    const menu = document.getElementById('order-autocomplete-list');

    input.addEventListener('input', async () => {
        const val = input.value.trim();
        if (!val) {
            menu.classList.remove('show');
            return;
        }

        try {
            const supabase = await getSupabase();
            const { data, error } = await supabase
                .from('order_list')
                .select('*')
                .ilike('order_number', `%${val}%`)
                .limit(5);

            if (error || !data || data.length === 0) {
                menu.classList.remove('show');
                return;
            }

            menu.innerHTML = data.map(o => `
                <li><a class="dropdown-item" href="#" data-order="${o.order_number}" data-prod="${o.product_number || ''}" data-name="${o.product_name || ''}" data-qty="${o.quantity || 0}">
                    📦 工單: <strong>${o.order_number}</strong> | 品名: ${o.product_name || ''}
                </a></li>
            `).join('');
            menu.classList.add('show');

            menu.querySelectorAll('a').forEach(item => {
                item.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const orderNum = item.getAttribute('data-order');
                    const prodNum = item.getAttribute('data-prod');
                    const prodName = item.getAttribute('data-name');
                    const qty = item.getAttribute('data-qty');

                    input.value = orderNum;
                    document.getElementById('field-product_number').value = prodNum;
                    document.getElementById('field-product_name').value = prodName;
                    document.getElementById('field-quantity').value = qty;
                    menu.classList.remove('show');

                    // 跨表二次聯動：自動去 spec_list 撈取 spec 與 version
                    if (prodNum) {
                        const { data: specData } = await supabase
                            .from('spec_list')
                            .select('*')
                            .eq('product_number', prodNum)
                            .limit(1);

                        if (specData && specData.length > 0) {
                            document.getElementById('field-spec').value = specData[0].spec || '';
                            document.getElementById('field-draw_ver').value = specData[0].version || '';
                        } else {
                            document.getElementById('field-spec').value = '⚠️ 找不到此品號之規格建檔';
                            document.getElementById('field-draw_ver').value = 'N/A';
                        }
                    }
                });
            });

        } catch (err) {
            console.error("工單即時補全連動發生錯誤:", err);
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== input) menu.classList.remove('show');
    });
}

/**
 * 開啟主表單 Modal
 */
function openMainCrud(mode, id = null) {
    const form = document.getElementById('ipqc-crud-form');
    form.reset();
    document.getElementById('field-id').value = '';
    document.getElementById('ipqcCrudModalTitle').innerText = mode === 'add' ? '新增巡檢紀錄' : '編輯巡檢紀錄';
    
    if (mode === 'add') {
        const now = new Date();
        document.getElementById('field-date').value = now.toISOString().split('T')[0];
        document.getElementById('field-time').value = now.toTimeString().substring(0, 5);
        document.getElementById('field-inspector').value = "Leo Wu"; 
    }

    if (mode === 'edit' && id) {
        const row = mainData.find(r => String(r.id) === String(id));
        if (row) {
            document.getElementById('field-id').value = row.id;
            document.getElementById('field-date').value = row.date || '';
            document.getElementById('field-time').value = row.time || '';
            document.getElementById('field-order_number').value = row.order_number || '';
            document.getElementById('field-product_number').value = row.product_number || '';
            document.getElementById('field-product_name').value = row.product_name || '';
            document.getElementById('field-quantity').value = row.quantity || 0;
            document.getElementById('field-spec').value = row.spec || '';
            document.getElementById('field-draw_ver').value = row.draw_ver || '';
            document.getElementById('field-operator').value = row.operator || '';
            document.getElementById('field-inspector').value = row.inspector || 'Leo Wu';
            document.getElementById('field-determination').value = row.determination || 'PASS';
            document.getElementById('field-defect_classification').value = row.defect_classification || '';
            document.getElementById('field-defect_status').value = row.defect_status || '';
            document.getElementById('field-handling_measures').value = row.handling_measures || '';
            document.getElementById('field-remark').value = row.remark || '';
        }
    }
    bsMainModal.show();
}
window.editMainRecord = (id) => openMainCrud('edit', id);

/**
 * 提交主表單
 */
async function handleMainSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('field-id').value;
    
    const payload = {
        date: document.getElementById('field-date').value,
        time: document.getElementById('field-time').value,
        order_number: document.getElementById('field-order_number').value.trim(),
        product_number: document.getElementById('field-product_number').value.trim(),
        product_name: document.getElementById('field-product_name').value.trim(),
        quantity: parseInt(document.getElementById('field-quantity').value) || 0,
        spec: document.getElementById('field-spec').value.trim(),
        draw_ver: document.getElementById('field-draw_ver').value.trim(),
        operator: document.getElementById('field-operator').value,
        inspector: document.getElementById('field-inspector').value,
        determination: document.getElementById('field-determination').value,
        defect_classification: document.getElementById('field-defect_classification').value,
        defect_status: document.getElementById('field-defect_status').value.trim(),
        handling_measures: document.getElementById('field-handling_measures').value.trim(),
        remark: document.getElementById('field-remark').value.trim()
    };

    try {
        const supabase = await getSupabase();
        let resError = null;

        if (id) {
            const { error } = await supabase.from('ipqc_list').update(payload).eq('id', id);
            resError = error;
        } else {
            const { error } = await supabase.from('ipqc_list').insert([payload]);
            resError = error;
        }

        bsMainModal.hide();
        if (resError) throw resError;

        ModalComponent.show("操作成功", "巡檢紀錄明細已成功同步！", "success");
        await fetchMainRecords();

    } catch (err) {
        ModalComponent.show("更新失敗", `儲存資料失敗：${err.message}`, "danger");
    }
}

/**
 * 刪除主紀錄
 */
window.deleteMainRecord = (id) => {
    askConfirmation("您確定要刪除這筆製程巡檢紀錄明細嗎？此動作無法復原。", async () => {
        try {
            const supabase = await getSupabase();
            const { error } = await supabase.from('ipqc_list').delete().eq('id', id);
            if (error) throw error;
            
            ModalComponent.show("刪除成功", "紀錄已移除。", "success");
            await fetchMainRecords();
        } catch (err) {
            ModalComponent.show("刪除失敗", err.message, "danger");
        }
    });
};

// ============================================================================
// ==================== 四個子資料表快捷內建核心工作台 (共用邏輯) ====================
// ============================================================================

const SUB_CONFIGS = {
    defect_list: {
        title: "不良分類維護 (defect_list)",
        fields: [{ id: "defect_type", label: "不良分類名稱", type: "text", req: true }],
        headers: ["不良分類名稱"],
        rowMapper: (r) => `<td>${r.defect_type || ''}</td>`
    },
    order_list: {
        title: "製令工單維護 (order_list)",
        fields: [
            { id: "order_number", label: "製令工單號", type: "text", req: true },
            { id: "product_number", label: "品號", type: "text", req: true },
            { id: "product_name", label: "品名", type: "text", req: true },
            { id: "quantity", label: "數量", type: "number", req: true }
        ],
        headers: ["工單號", "品號", "品名", "數量"],
        rowMapper: (r) => `<td>${r.order_number || ''}</td><td>${r.product_number || ''}</td><td>${r.product_name || ''}</td><td>${r.quantity || 0}</td>`
    },
    operator_list: {
        title: "人員清單維護 (operator_list)",
        fields: [
            { id: "name", label: "姓名", type: "text", req: true },
            { id: "department", label: "部門名稱", type: "text", req: true }
        ],
        headers: ["姓名", "部門名稱"],
        rowMapper: (r) => `<td>${r.name || ''}</td><td>${r.department || ''}</td>`
    },
    spec_list: {
        title: "規格版本維護 (spec_list)",
        fields: [
            { id: "product_number", label: "品號", type: "text", req: true },
            { id: "spec", label: "產品規格", type: "text", req: true },
            { id: "version", label: "版次 (Version)", type: "text", req: true }
        ],
        headers: ["品號", "規格說明", "版次"],
        rowMapper: (r) => `<td>${r.product_number || ''}</td><td>${r.spec || ''}</td><td>${r.version || ''}</td>`
    }
};

async function openSubManager(tableName) {
    subCurrentTable = tableName;
    subPage = 1;
    document.getElementById('sub-search').value = '';
    document.getElementById('sub-data-form').classList.add('d-none');
    document.getElementById('subManagerModalTitle').innerText = SUB_CONFIGS[tableName].title;
    
    const config = SUB_CONFIGS[tableName];
    const thead = document.getElementById('sub-table-thead');
    thead.innerHTML = `<tr>${config.headers.map(h => `<th>${h}</th>`).join('')}<th style="width:90px;" class="text-center">操作</th></tr>`;

    await fetchSubRecords();
    bsSubModal.show();
}

async function fetchSubRecords() {
    try {
        const supabase = await getSupabase();
        const { data, error } = await supabase.from(subCurrentTable).select('*');
        if (error) throw error;
        subData = data || [];
        doSubSearch();
    } catch (err) {
        console.error("讀取子表失敗:", err);
    }
}

function doSubSearch() {
    const kw = document.getElementById('sub-search').value.toLowerCase().trim();
    const fields = SUB_CONFIGS[subCurrentTable].fields;
    
    subFilteredData = subData.filter(row => {
        return !kw || fields.some(f => String(row[f.id] || '').toLowerCase().includes(kw));
    });
    subPage = 1;
    renderSubTable();
}

function renderSubTable() {
    const tbody = document.getElementById('sub-table-tbody');
    const config = SUB_CONFIGS[subCurrentTable];
    
    if (subFilteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${config.headers.length + 1}" class="text-center text-muted py-3">無項目資料</td></tr>`;
        updateSubPagination(0);
        return;
    }

    const startIdx = (subPage - 1) * subPageSize;
    const endIdx = Math.min(startIdx + subPageSize, subFilteredData.length);
    const pageData = subFilteredData.slice(startIdx, endIdx);

    tbody.innerHTML = pageData.map(row => `
        <tr>
            ${config.rowMapper(row)}
            <td class="text-center">
                <button class="btn btn-xs btn-outline-secondary me-1" type="button" onclick="window.editSubRecord('${row.id}')"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-xs btn-outline-danger" type="button" onclick="window.deleteSubRecord('${row.id}')"><i class="bi bi-trash3"></i></button>
            </td>
        </tr>
    `).join('');

    updateSubPagination(subFilteredData.length, startIdx + 1, endIdx);
}

function updateSubPagination(totalCount, startRange = 0, endRange = 0) {
    const info = document.getElementById('sub-pagination-info');
    info.innerText = `共 ${totalCount} 筆，第 ${totalCount > 0 ? startRange : 0}~${endRange} 筆`;
    const pagesContainer = document.getElementById('sub-pagination-pages');
    pagesContainer.innerHTML = '';
    if (totalCount === 0) return;

    const totalPages = Math.ceil(totalCount / subPageSize);
    let startP = Math.max(1, subPage - 1);
    let endP = Math.min(totalPages, startP + 2);
    if (endP - startP < 2) startP = Math.max(1, endP - 2);

    pagesContainer.innerHTML += `<li class="page-item ${subPage === 1 ? 'disabled' : ''}"><a class="page-link py-0 px-2" href="#" data-sp="${subPage - 1}">&laquo;</a></li>`;
    for (let i = startP; i <= endP; i++) {
        pagesContainer.innerHTML += `<li class="page-item ${subPage === i ? 'active' : ''}"><a class="page-link py-0 px-2" href="#" data-sp="${i}">${i}</a></li>`;
    }
    pagesContainer.innerHTML += `<li class="page-item ${subPage === totalPages ? 'disabled' : ''}"><a class="page-link py-0 px-2" href="#" data-sp="${subPage + 1}">&raquo;</a></li>`;

    pagesContainer.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const p = parseInt(e.target.getAttribute('data-sp'));
            if (p >= 1 && p <= totalPages) {
                subPage = p;
                renderSubTable();
            }
        });
    });
}

function toggleSubFormAdd() {
    subFormMode = 'add';
    document.getElementById('sub-form-title').innerText = "新增項目內容";
    document.getElementById('sub-field-id').value = '';
    buildSubFormFields();
    document.getElementById('sub-data-form').classList.remove('d-none');
}

window.editSubRecord = (id) => {
    subFormMode = 'edit';
    document.getElementById('sub-form-title').innerText = "編輯項目內容";
    const row = subData.find(r => String(r.id) === String(id));
    if (!row) return;

    document.getElementById('sub-field-id').value = row.id;
    buildSubFormFields(row);
    document.getElementById('sub-data-form').classList.remove('d-none');
};

function buildSubFormFields(rowData = null) {
    const container = document.getElementById('sub-form-fields-container');
    const fields = SUB_CONFIGS[subCurrentTable].fields;

    container.innerHTML = fields.map(f => {
        const val = rowData ? (rowData[f.id] || '') : '';
        return `
            <div class="col">
                <label class="form-label mb-0 small text-muted">${f.label}</label>
                <input type="${f.type}" id="sub-input-${f.id}" class="form-control form-control-sm" value="${val}" ${f.req ? 'required' : ''}>
            </div>
        `;
    }).join('');
}

async function handleSubSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('sub-field-id').value;
    const fields = SUB_CONFIGS[subCurrentTable].fields;
    const payload = {};
    
    fields.forEach(f => {
        const input = document.getElementById(`sub-input-${f.id}`);
        payload[f.id] = f.type === 'number' ? (parseInt(input.value) || 0) : input.value.trim();
    });

    try {
        const supabase = await getSupabase();
        let err = null;
        if (subFormMode === 'edit' && id) {
            const { error } = await supabase.from(subCurrentTable).update(payload).eq('id', id);
            err = error;
        } else {
            const { error } = await supabase.from(subCurrentTable).insert([payload]);
            err = error;
        }

        if (err) throw err;
        
        document.getElementById('sub-data-form').classList.add('d-none');
        ModalComponent.show("子表更新成功", "關聯項目已同步！", "success");
        await fetchSubRecords();
        await loadDropdownOptions();

    } catch (err) {
        ModalComponent.show("更新失敗", err.message, "danger");
    }
}

window.deleteSubRecord = (id) => {
    askConfirmation("您確定要刪除這筆項目資料嗎？", async () => {
        try {
            const supabase = await getSupabase();
            const { error } = await supabase.from(subCurrentTable).delete().eq('id', id);
            if (error) throw error;
            
            ModalComponent.show("項目刪除成功", "資料已自子資料表清除。", "success");
            await fetchSubRecords();
            await loadDropdownOptions();
        } catch (err) {
            ModalComponent.show("刪除失敗", "該項目已被巡檢明細表或工單參考參照，拒絕刪除。", "danger");
        }
    });
};

// ============================================================================
// ==================== 整合 SheetJS Excel 匯入與匯出處理邏輯 ====================
// ============================================================================

function exportMainExcel() {
    if (!window.XLSX) return;
    const wb = XLSX.utils.book_new();
    const cleanRows = filteredData.map(({ id, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(cleanRows);
    XLSX.utils.book_append_sheet(wb, ws, "IPQC主資料");
    XLSX.writeFile(wb, `IPQC_巡檢紀錄_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportSubExcel() {
    if (!window.XLSX) return;
    const wb = XLSX.utils.book_new();
    const cleanRows = subFilteredData.map(({ id, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(cleanRows);
    XLSX.utils.book_append_sheet(wb, ws, "子表數據");
    XLSX.writeFile(wb, `Backup_${subCurrentTable}.xlsx`);
}

function importExcel(e, targetType) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const ws = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws);

            if (json.length === 0) {
                ModalComponent.show("匯入失敗", "未發現有效數據 rows", "danger");
                return;
            }

            const supabase = await getSupabase();
            const targetTable = targetType === 'main' ? 'ipqc_list' : subCurrentTable;
            
            const { error } = await supabase.from(targetTable).insert(json);
            if (error) throw error;

            ModalComponent.show("匯入成功", `成功從 Excel 匯入 ${json.length} 筆資料！`, "success");
            
            if (targetType === 'main') {
                await fetchMainRecords();
            } else {
                await fetchSubRecords();
                await loadDropdownOptions();
            }

        } catch (err) {
            ModalComponent.show("匯入解析錯誤", `請確認欄位格式：${err.message}`, "danger");
        }
        e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}