// utils/utils.js
export const FormatUtility = {
    /**
     * 將 Date 物件格式化為 YYYY-MM-DD HH:mm:ss 字串
     * @param {Date} date 
     * @returns {string}
     */
    formatDateTime(date) {
        if (!(date instanceof Date)) return '';
        const pad = (num) => String(num).padStart(2, '0');
        
        const yyyy = date.getFullYear();
        const mm = pad(date.getMonth() + 1);
        const dd = pad(date.getDate());
        const hh = pad(date.getHours());
        const min = pad(date.getMinutes());
        const ss = pad(date.getSeconds());

        return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    }
};