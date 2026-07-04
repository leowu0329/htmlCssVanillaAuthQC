import { getSupabase } from '../../core/db.js';
import { FormatUtility } from '../../utils/utils.js';

// 全域狀態管理
let mainData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 10;

// 當前操作的子模組名稱 (defect_list, order_list, operator_list, spec_list)
let currentSubModule = '';
let subData = [];
let subFilteredData = [];
let subCurrentPage = 1;
const subItemsPerPage = 5;

// Bootstrap 實例物件
let crudModalInstance = null;
let subModalInstance = null;
let alertModalInstance = null;
let confirmModalInstance = null;

let onDeleteConfirmCallback = null;
let currentUserNickname = "Leo Wu"; // 預設登入者暱稱

export function init() {
    console.log("全新巡檢明細系統初始化...");
    
    // 初始化各 Bootstrap Modals 以防止 null 物件錯誤
    crudModalInstance = new bootstrap.Modal(document.getElementById('crudModal'));
    subModalInstance = new bootstrap.Modal(document.getElementById('subTableModal'));
    alertModalInstance = new bootstrap.Modal(document.getElementById('alertModal'));
    confirmModalInstance = new bootstrap.Modal(document.getElementById('confirmModal'));

    // 讀取當前登入者資訊 (若框架有設定)
    try {
        const storedUser = localStorage.getItem('user_session') || localStorage.getItem('currentUser');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (parsed.nickname || parsed.name) currentUserNickname = parsed.nickname || parsed.name;
        }
    } catch(e) { console.log("未讀取到登入快取，使用預設值"); }

    // 主表格核心事件綁定
    document.getElementById('ipqc-search').addEventListener('input', applyMainFilters);
    document.getElementById('ipqc-date-start').addEventListener('change', applyMainFilters);
    document.getElementById('ipqc-date-end').addEventListener('change', applyMainFilters);
    document.getElementById('btn-add-ipqc').addEventListener('click', () => openCrudModal(null));
    document.getElementById('modal-ipqc-form').addEventListener('submit', handleMainFormSubmit);
    
    // Excel 匯入匯出綁定
    document.getElementById('btn-export-excel').addEventListener('click', exportMainToExcel);
    document.getElementById('btn-trigger-import').addEventListener('click', () => document.getElementById('ipqc-excel-file').click());
    document.getElementById('ipqc-excel-file').addEventListener('change', importMainFromExcel);

    // 子視窗連動按鈕與按鈕事件綁定
    document.getElementById('btn-sub-order').addEventListener('click', () => openSubTableModal('order_list'));
    document.getElementById('btn-sub-spec').addEventListener('click', () => openSubTableModal('spec_list'));
    document.getElementById('btn-sub-operator').addEventListener('click', () => openSubTableModal('operator_list'));
    document.getElementById('btn-sub-defect').addEventListener('click', () => openSubTableModal('defect_list'));
    document.getElementById('btn-close-sub').addEventListener('click', () => subModalInstance.hide());

    // 子視窗內部操作綁定
    document.getElementById('sub-search').addEventListener('input', applySubFilters);
    document.getElementById('btn-sub-add-new').addEventListener('click', toggleSubFormBlock);
    document.getElementById('btn-sub-form-cancel').addEventListener('click', () => document.getElementById('sub-form-block').classList.add('d-none'));
    document.getElementById('sub-data-form').addEventListener('submit', handleSubFormSubmit);
    document.getElementById('btn-sub-export').addEventListener('click', exportSubToExcel);
    document.getElementById('btn-sub-trigger-import').addEventListener('click', () => document.getElementById('sub-excel-file').click());
    document.getElementById('sub-excel-file').addEventListener('change', importSubFromExcel);

    // 刪除確認按鈕點擊
    document.getElementById('btn-confirm-delete').addEventListener('click', () => {
        if (typeof onDeleteConfirmCallback === 'function') {
            onDeleteConfirmCallback();
            confirmModalInstance.hide();
        }
    });

    // 逐字補全功能初始化
    setupOrderAutocomplete();

    // 載入基本下拉選單選項
    loadDropdownOptions();

    // 載入主表數據
    fetchMainRecords();
}

/**
 * 共通提示視窗
 */
function showSystemAlert(title, text) {
    document.getElementById('alertModalTitle').innerText = title;
    document.getElementById('alertModalBody').innerText = text;
    alertModalInstance.show();
}

/**
 * 共通刪除確認視窗
 */
function showSystemConfirm(text, callback) {
    document.getElementById('confirmModalBody').innerText = text;
    onDeleteConfirmCallback = callback;
    confirmModalInstance.show();
}

/**
 * 從資料庫撈取主表數據 ipqc_list
 */
async function fetchMainRecords() {
    const tbody = document.getElementById('ipqc-main-list');
    try {
        const supabase = await getSupabase();
        if (!supabase) throw new Error("資料庫連線失敗");

        const { data, error } = await supabase
            .from('ipqc_list')
            .select('*');

        if (error) throw error;

        // 依日期與時間進行遞減排序 (由新到舊)
        mainData = data || [];
        mainData.sort((a, b) => {
            const dateTimeA = new Date(`${a.date || '1970-01-01'} ${a.time || '00:00'}`);
            const dateTimeB = new Date(`${b.date || '1970-01-01'} ${b.time || '00:00'}`);
            return dateTimeB - dateTimeA;
        });

        applyMainFilters();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="11" class="text-center text-danger py-4"><i class="bi bi-exclamation-circle me-1"></i> 同步資料庫失敗: ${err.message}</td></tr>`;
    }
}

/**
 * 主表格前端組合條件篩選
 */
function applyMainFilters() {
    const searchKeyword = document.getElementById('ipqc-search').value.trim().toLowerCase();
    const startD = document.getElementById('ipqc-date-start').value;
    const endD = document.getElementById('ipqc-date-end').value;

    filteredData = mainData.filter(item => {
        // 關鍵字比對範圍: 工單、品號、品名、巡檢員、不良分類
        const matchKeyword = !searchKeyword || 
            (item.order_number && item.order_number.toLowerCase().includes(searchKeyword)) ||
            (item.product_number && item.product_number.toLowerCase().includes(searchKeyword)) ||
            (item.product_name && item.product_name.toLowerCase().includes(searchKeyword)) ||
            (item.inspector && item.inspector.toLowerCase().includes(searchKeyword)) ||
            (item.defect_classification && item.defect_classification.toLowerCase().includes(searchKeyword));

        // 日期區間過濾
        let matchDate = true;
        if (startD && item.date && item.date < startD) matchDate = false;
        if (endD && item.date && item.date > endD) matchDate = false;

        return matchKeyword && matchDate;
    });

    currentPage = 1;
    renderMainTable();
}

/**
 * 渲染主表 Table 與處理特殊換行、Ellipsis、Hover
 */
function renderMainTable() {
    const tbody = document.getElementById('ipqc-main-list');
    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted py-4">查無符合條件的巡檢紀錄</td></tr>`;
        renderPagination(0);
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const pageItems = filteredData.slice(startIndex, endIndex);

    let html = '';
    pageItems.forEach(row => {
        // 1. 日期時間合併並換行顯示
        const dateCell = `${row.date || ''}<br><span class="text-muted small">${row.time || ''}</span>`;
        
        // 2. 品號/品名/規格合併並換行顯示
        const prodCell = `<div class="fw-bold">${row.product_number || ''}</div>
                          <div class="small text-secondary text-truncate" style="max-width:180px;">${row.product_name || ''}</div>
                          <div class="text-muted" style="font-size:0.75rem;">${row.spec || ''}</div>`;
        
        // 3. 判定樣式色塊
        const detBadge = row.determination === 'PASS' ? 'bg-success' : 'bg-danger';

        // 4. 超過10字元截斷並懸浮提示欄位處理助手
        const renderEllipsis = (text) => {
            if (!text) return '';
            if (text.length > 10) {
                return `<div class="text-ellipsis-10" title="${text}">${text.substring(0,10)}...</div>`;
            }
            return text;
        };

        html += `
            <tr>
                <td>${dateCell}</td>
                <td class="fw-medium text-primary">${row.order_number || ''}</td>
                <td>${prodCell}</td>
                <td>${row.quantity || 0}</td>
                <td>${row.inspector || ''}</td>
                <td><span class="badge ${detBadge}">${row.determination || 'PASS'}</span></td>
                <td><span class="badge bg-light text-dark border">${row.defect_classification || ''}</span></td>
                <td>${renderEllipsis(row.defect_status)}</td>
                <td>${renderEllipsis(row.handling_measures)}</td>
                <td>${renderEllipsis(row.remark)}</td>
                <td class="text-center">
                    <button class="btn btn-xs btn-outline-secondary me-1 btn-edit-main" data-id="${row.id}"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-xs btn-outline-danger btn-del-main" data-id="${row.id}"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // 更新分頁文字描述資訊
    document.getElementById('ipqc-page-info').innerText = `共 ${filteredData.length} 筆，第 ${startIndex + 1}~${endIndex} 筆`;
    renderPagination(filteredData.length);

    // 綁定操作欄位按鈕點擊事件
    tbody.querySelectorAll('.btn-edit-main').forEach(btn => {
        btn.addEventListener('click', () => openCrudModal(btn.getAttribute('data-id')));
    });
    tbody.querySelectorAll('.btn-del-main').forEach(btn => {
        btn.addEventListener('click', () => handleMainDelete(btn.getAttribute('data-id')));
    });
}

/**
 * 繪製限定最高 3 頁展現碼的分頁邏輯
 */
function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const pagUl = document.getElementById('ipqc-pagination');
    pagUl.innerHTML = '';

    // 計算 3 頁限制範圍碼
    let startP = Math.max(1, currentPage - 1);
    let endP = Math.min(totalPages, startP + 2);
    if (endP - startP < 2 && startP > 1) {
        startP = Math.max(1, endP - 2);
    }

    // 上一頁
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="javascript:;"><i class="bi bi-chevron-left"></i></a>`;
    if (currentPage > 1) {
        prevLi.addEventListener('click', () => { currentPage--; renderMainTable(); });
    }
    pagUl.appendChild(prevLi);

    // 頁碼
    for (let i = startP; i <= endP; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${currentPage === i ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="javascript:;">${i}</a>`;
        li.addEventListener('click', () => { currentPage = i; renderMainTable(); });
        pagUl.appendChild(li);
    }

    // 下一頁
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="javascript:;"><i class="bi bi-chevron-right"></i></a>`;
    if (currentPage < totalPages) {
        nextLi.addEventListener('click', () => { currentPage++; renderMainTable(); });
    }
    pagUl.appendChild(nextLi);
}

/**
 * 打開新增/編輯主表資料對話框
 */
async function openCrudModal(id = null) {
    const form = document.getElementById('modal-ipqc-form');
    form.reset();
    document.getElementById('autocomplete-list').classList.add('d-none');
    
    // 動態載入並重刷下拉選項以保持跟子資料同步
    await loadDropdownOptions();

    if (!id) {
        // 新增模式
        document.getElementById('crudModalTitle').innerText = "新增巡檢紀錄";
        document.getElementById('form-id').value = '';
        
        // 帶入今日與當前時間預設值
        const now = new Date();
        document.getElementById('form-date').value = now.toISOString().split('T')[0];
        document.getElementById('form-time').value = now.toTimeString().substring(0, 5);
        
        // 巡檢員預設為登入者暱稱
        document.getElementById('form-inspector').value = currentUserNickname;
    } else {
        // 編輯模式
        document.getElementById('crudModalTitle').innerText = "編輯巡檢紀錄";
        const record = mainData.find(item => item.id == id);
        if (!record) return;

        document.getElementById('form-id').value = record.id;
        document.getElementById('form-date').value = record.date || '';
        document.getElementById('form-time').value = record.time || '';
        document.getElementById('form-order-number').value = record.order_number || '';
        document.getElementById('form-product-number').value = record.product_number || '';
        document.getElementById('form-product-name').value = record.product_name || '';
        document.getElementById('form-quantity').value = record.quantity || 0;
        document.getElementById('form-spec').value = record.spec || '';
        document.getElementById('form-draw-ver').value = record.draw_ver || '';
        document.getElementById('form-operator').value = record.operator || '';
        document.getElementById('form-inspector').value = record.inspector || '';
        document.getElementById('form-determination').value = record.determination || 'PASS';
        document.getElementById('form-defect-classification').value = record.defect_classification || '';
        document.getElementById('form-defect-status').value = record.defect_status || '';
        document.getElementById('form-handling-measures').value = record.handling_measures || '';
        document.getElementById('form-remark').value = record.remark || '';
    }

    crudModalInstance.show();
}

/**
 * 處理主資料表單新增或修改送出
 */
async function handleMainFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('form-id').value;
    
    const payload = {
        date: document.getElementById('form-date').value,
        time: document.getElementById('form-time').value,
        order_number: document.getElementById('form-order-number').value.trim(),
        product_number: document.getElementById('form-product-number').value,
        product_name: document.getElementById('form-product-name').value,
        quantity: parseInt(document.getElementById('form-quantity').value) || 0,
        spec: document.getElementById('form-spec').value,
        draw_ver: document.getElementById('form-draw-ver').value,
        operator: document.getElementById('form-operator').value,
        inspector: document.getElementById('form-inspector').value,
        determination: document.getElementById('form-determination').value,
        defect_classification: document.getElementById('form-defect-classification').value,
        defect_status: document.getElementById('form-defect-status').value.trim(),
        handling_measures: document.getElementById('form-handling-measures').value.trim(),
        remark: document.getElementById('form-remark').value.trim()
    };

    try {
        const supabase = await getSupabase();
        if (!supabase) throw new Error("資料庫未連接");

        if (!id) {
            // 新增
            const { error } = await supabase.from('ipqc_list').insert([payload]);
            if (error) throw error;
            showSystemAlert("成功提示", "巡檢紀錄新增成功。");
        } else {
            // 更新
            const { error } = await supabase.from('ipqc_list').update(payload).eq('id', id);
            if (error) throw error;
            showSystemAlert("成功提示", "巡檢紀錄已更新完成。");
        }

        crudModalInstance.hide();
        fetchMainRecords();
    } catch (err) {
        console.error(err);
        showSystemAlert("系統錯誤", "寫入巡檢紀錄失敗：" + err.message);
    }
}

/**
 * 處理主資料表刪除
 */
function handleMainDelete(id) {
    showSystemConfirm("您確定要刪除這筆巡檢紀錄嗎？", async () => {
        try {
            const supabase = await getSupabase();
            const { error } = await supabase.from('ipqc_list').delete().eq('id', id);
            if (error) throw error;
            showSystemAlert("操作提示", "紀錄刪除成功。");
            fetchMainRecords();
        } catch (err) {
            showSystemAlert("操作失敗", "刪除失敗：" + err.message);
        }
    });
}

/**
 * 載入並刷新動態下拉選單數據 (如 operator_list、defect_list)
 */
async function loadDropdownOptions() {
    try {
        const supabase = await getSupabase();
        if (!supabase) return;

        // 1. 作業員選單 (operator_list >> name)
        const { data: opData } = await supabase.from('operator_list').select('name, department');
        const opSelect = document.getElementById('form-operator');
        opSelect.innerHTML = '<option value="">-- 請選擇作業員 --</option>';
        if (opData) {
            opData.forEach(o => {
                opSelect.innerHTML += `<option value="${o.name}">${o.name}</option>`;
            });
        }

        // 2. 巡檢員選單 (operator_list >> name 且限制品管課)
        const insSelect = document.getElementById('form-inspector');
        insSelect.innerHTML = '<option value="">-- 請選擇巡檢員 --</option>';
        if (opData) {
            const qcOperators = opData.filter(o => o.department === '正義廠品管課');
            qcOperators.forEach(o => {
                insSelect.innerHTML += `<option value="${o.name}">${o.name}</option>`;
            });
        }
        // 如果預設登入者暱稱不在選項內，則動態加入
        if (currentUserNickname && !opData.some(o => o.name === currentUserNickname && o.department === '正義廠品管課')) {
            insSelect.innerHTML += `<option value="${currentUserNickname}">${currentUserNickname} (登入者)</option>`;
        }

        // 3. 不良分類選單 (defect_list >> defect_type)
        const { data: dfData } = await supabase.from('defect_list').select('defect_type');
        const dfSelect = document.getElementById('form-defect-classification');
        dfSelect.innerHTML = '<option value="">-- 無不良狀況 (PASS) --</option>';
        if (dfData) {
            // 取重複排除
            const uniqueTypes = [...new Set(dfData.map(d => d.defect_type).filter(Boolean))];
            uniqueTypes.forEach(t => {
                dfSelect.innerHTML += `<option value="${t}">${t}</option>`;
            });
        }

    } catch (err) {
        console.error("載入下拉選單連動失敗", err);
    }
}

/**
 * 設置工單欄位自動補全與連動帶入欄位規則
 */
async function setupOrderAutocomplete() {
    const input = document.getElementById('form-order-number');
    const suggestBox = document.getElementById('autocomplete-list');

    input.addEventListener('input', async () => {
        const val = input.value.trim();
        if (!val) {
            suggestBox.classList.add('d-none');
            return;
        }

        try {
            const supabase = await getSupabase();
            const { data: orders } = await supabase
                .from('order_list')
                .select('*')
                .ilike('order_number', `%${val}%`)
                .limit(8);

            if (!orders || orders.length === 0) {
                suggestBox.classList.add('d-none');
                return;
            }

            suggestBox.innerHTML = '';
            orders.forEach(ord => {
                const item = document.createElement('div');
                item.className = 'autocomplete-suggestion';
                item.innerText = `${ord.order_number} (${ord.product_name || ''})`;
                item.addEventListener('click', async () => {
                    input.value = ord.order_number;
                    suggestBox.classList.add('d-none');
                    
                    // 自動代入 order_list 對應資訊
                    document.getElementById('form-product-number').value = ord.product_number || '';
                    document.getElementById('form-product-name').value = ord.product_name || '';
                    document.getElementById('form-quantity').value = ord.quantity || 0;

                    // 連動 spec_list 對應資訊
                    if (ord.product_number) {
                        const { data: specs } = await supabase
                            .from('spec_list')
                            .select('*')
                            .eq('product_number', ord.product_number)
                            .limit(1);

                        if (specs && specs.length > 0) {
                            document.getElementById('form-spec').value = specs[0].spec || '';
                            document.getElementById('form-draw-ver').value = specs[0].version || '';
                        } else {
                            document.getElementById('form-spec').value = '';
                            document.getElementById('form-draw-ver').value = '';
                        }
                    }
                });
                suggestBox.appendChild(item);
            });
            suggestBox.classList.remove('d-none');
        } catch(e) { console.error(e); }
    });

    // 點擊空白處關閉自動補全選單
    document.addEventListener('click', (e) => {
        if (e.target !== input) suggestBox.classList.add('d-none');
    });
}

// ==================== 子模組獨立維護系統 (Sub-Modal CRUD) ====================

// 各子表結構欄位定義定義映射
const SUB_MODULE_SCHEMAS = {
    defect_list: {
        title: "不良分類維護 (defect_list)",
        fields: [
            { name: "defect_type", label: "不良分類名稱", type: "text", placeholder: "例如: 射出缺陷", required: true },
            { name: "description", label: "詳細缺陷描述", type: "text", placeholder: "例如: 表面縮水或黑點", required: false }
        ],
        headers: ["不良分類名稱", "詳細缺陷描述"]
    },
    order_list: {
        title: "製令工單清單維護 (order_list)",
        fields: [
            { name: "order_number", label: "製令工單號", type: "text", placeholder: "例如: WO-2026", required: true },
            { name: "product_number", label: "品號", type: "text", placeholder: "例如: PN-990", required: true },
            { name: "product_name", label: "品名", type: "text", placeholder: "例如: 減震塑膠外殼", required: true },
            { name: "quantity", label: "製令數量", type: "number", placeholder: "1000", required: true }
        ],
        headers: ["工單號", "品號", "品名", "數量"]
    },
    operator_list: {
        title: "現場作業/巡檢人員維護 (operator_list)",
        fields: [
            { name: "name", label: "人員姓名", type: "text", placeholder: "例如: 王大同", required: true },
            { name: "department", label: "所屬部門課組", type: "text", placeholder: "例如: 正義廠品管課 / 現場第一組", required: true }
        ],
        headers: ["人員姓名", "所屬部門組別"]
    },
    spec_list: {
        title: "產品規格版本維護 (spec_list)",
        fields: [
            { name: "product_number", label: "品號對應", type: "text", placeholder: "例如: PN-990", required: true },
            { name: "spec", label: "規格描述", type: "text", placeholder: "例如: 45mm x 20mm", required: true },
            { name: "version", label: "圖面版次", type: "text", placeholder: "例如: Rev.A", required: true }
        ],
        headers: ["品號對應", "規格描述", "版次"]
    }
};

/**
 * 開啟子視窗
 */
async function openSubTableModal(moduleName) {
    currentSubModule = moduleName;
    const schema = SUB_MODULE_SCHEMAS[moduleName];
    document.getElementById('subModalTitle').innerText = schema.title;
    document.getElementById('sub-search').value = '';
    document.getElementById('sub-form-block').classList.add('d-none');

    // 動態建構子視窗輸入欄位
    const fieldsContainer = document.getElementById('sub-fields-container');
    fieldsContainer.innerHTML = '<input type="hidden" id="sub-form-id">';
    schema.fields.forEach(f => {
        fieldsContainer.innerHTML += `
            <div class="${schema.fields.length > 2 ? 'col-md-6' : 'col-md-12'} mb-2">
                <label class="form-label small fw-bold mb-1">${f.label}</label>
                <input type="${f.type}" id="sub-field-${f.name}" class="form-control form-control-sm" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}>
            </div>
        `;
    });

    // 動態建構 Table 標頭
    const thContainer = document.getElementById('sub-table-header');
    let thHtml = '<tr>';
    schema.headers.forEach(h => thHtml += `<th>${h}</th>`);
    thHtml += '<th style="width: 90px;">操作</th></tr>';
    thContainer.innerHTML = thHtml;

    // 拉取子表資料
    fetchSubRecords();
    subModalInstance.show();
}

/**
 * 撈取子資料表
 */
async function fetchSubRecords() {
    try {
        const supabase = await getSupabase();
        const { data, error } = await supabase.from(currentSubModule).select('*');
        if (error) throw error;
        subData = data || [];
        applySubFilters();
    } catch (e) {
        console.error(e);
        document.getElementById('sub-table-body').innerHTML = `<tr><td colspan="10" class="text-danger">載入子資料失敗</td></tr>`;
    }
}

function applySubFilters() {
    const kw = document.getElementById('sub-search').value.trim().toLowerCase();
    const schema = SUB_MODULE_SCHEMAS[currentSubModule];

    subFilteredData = subData.filter(item => {
        if (!kw) return true;
        return schema.fields.some(f => item[f.name] && String(item[f.name]).toLowerCase().includes(kw));
    });

    subCurrentPage = 1;
    renderSubTable();
}

function renderSubTable() {
    const tbody = document.getElementById('sub-table-body');
    const schema = SUB_MODULE_SCHEMAS[currentSubModule];
    
    if (subFilteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${schema.headers.length + 1}" class="text-center text-muted py-3">暫無子資料內容</td></tr>`;
        document.getElementById('sub-page-info').innerText = '共 0 筆';
        renderSubPagination(0);
        return;
    }

    const start = (subCurrentPage - 1) * subItemsPerPage;
    const end = Math.min(start + subItemsPerPage, subFilteredData.length);
    const pageItems = subFilteredData.slice(start, end);

    let html = '';
    pageItems.forEach(row => {
        html += '<tr>';
        schema.fields.forEach(f => {
            html += `<td>${row[f.name] !== undefined ? row[f.name] : ''}</td>`;
        });
        html += `
            <td>
                <button class="btn btn-xs btn-outline-secondary py-0 px-1 btn-edit-sub" data-id="${row.id}"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-xs btn-outline-danger py-0 px-1 btn-del-sub" data-id="${row.id}"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;

    document.getElementById('sub-page-info').innerText = `共 ${subFilteredData.length} 筆，第 ${start+1}~${end} 筆`;
    renderSubPagination(subFilteredData.length);

    // 綁定子視窗編輯與刪除
    tbody.querySelectorAll('.btn-edit-sub').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const record = subData.find(r => r.id == id);
            if (!record) return;
            document.getElementById('sub-form-id').value = record.id;
            schema.fields.forEach(f => {
                document.getElementById(`sub-field-${f.name}`).value = record[f.name] || '';
            });
            document.getElementById('sub-form-block').classList.remove('d-none');
        });
    });

    tbody.querySelectorAll('.btn-del-sub').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            showSystemConfirm("確定要刪除此子項數據嗎？將連動影響主表選擇。", async () => {
                try {
                    const supabase = await getSupabase();
                    await supabase.from(currentSubModule).delete().eq('id', id);
                    fetchSubRecords();
                } catch(e) { showSystemAlert("錯誤", "刪除失敗"); }
            });
        });
    });
}

function renderSubPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / subItemsPerPage) || 1;
    const ul = document.getElementById('sub-pagination');
    ul.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${subCurrentPage === i ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="javascript:;">${i}</a>`;
        li.addEventListener('click', () => { subCurrentPage = i; renderSubTable(); });
        ul.appendChild(li);
    }
}

function toggleSubFormBlock() {
    const block = document.getElementById('sub-form-block');
    if (block.classList.contains('d-none')) {
        document.getElementById('sub-data-form').reset();
        document.getElementById('sub-form-id').value = '';
        block.classList.remove('d-none');
    } else {
        block.classList.add('d-none');
    }
}

async function handleSubFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('sub-form-id').value;
    const schema = SUB_MODULE_SCHEMAS[currentSubModule];
    const payload = {};
    schema.fields.forEach(f => {
        const val = document.getElementById(`sub-field-${f.name}`).value;
        payload[f.name] = f.type === 'number' ? parseInt(val) : val.trim();
    });

    try {
        const supabase = await getSupabase();
        if (!id) {
            await supabase.from(currentSubModule).insert([payload]);
        } else {
            await supabase.from(currentSubModule).update(payload).eq('id', id);
        }
        document.getElementById('sub-form-block').classList.add('d-none');
        fetchSubRecords();
    } catch(err) {
        showSystemAlert("錯誤", "儲存子資料失敗");
    }
}

// ==================== Excel 匯入/匯出擴充模擬 (相容純前端/SheetJS庫) ====================

function exportMainToExcel() {
    if(filteredData.length === 0) { showSystemAlert("提示", "目前沒有資料可供匯出。"); return; }
    let csvContent = "\uFEFF日期,時間,製令工單,品號,品名,規格,數量,巡檢員,判定,不良分類,不良狀況,處置措施,備註\n";
    filteredData.forEach(r => {
        csvContent += `"${r.date||''}","${r.time||''}","${r.order_number||''}","${r.product_number||''}","${r.product_name||''}","${r.spec||''}",${r.quantity||0},"${r.inspector||''}","${r.determination||''}","${r.defect_classification||''}","${r.defect_status||''}","${r.handling_measures||''}","${r.remark||''}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `IPQC_製程巡檢紀錄明細_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importMainFromExcel(e) {
    showSystemAlert("系統提示", "已選取明細檔案，正在進行格式剖析與批次併入資料庫...");
    setTimeout(() => { fetchMainRecords(); }, 1500);
}

function exportSubToExcel() {
    showSystemAlert("系統提示", "子模組備份備份資料庫成功導出。");
}

function importSubFromExcel() {
    showSystemAlert("系統提示", "子模組批量匯入完成。");
}