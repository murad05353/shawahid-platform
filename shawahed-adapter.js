/* شواهد — طبقة الربط مع Supabase (قالب غير مفعّل)
   لم تُؤكَّد أسماء الجداول والأعمدة بعد، لذلك كل قيمة في CONFIG فارغة ويجب استبدالها
   بالأسماء الحقيقية من المنصة الحالية. لا تضع مفاتيح سرية هنا.
   العميل (supabase client) يُمرَّر من المنصة الحالية، ولا يُنشأ في هذا الملف. */

const ShawahidAdapter = (() => {

  // TODO: املأ هذه القيم من المنصة الحالية دون تغيير أسماء الجداول أو بنيتها
  const CONFIG = {
    tables: {
      users: '',        // جدول المستخدمين
      schools: '',      // جدول المدارس
      records: '',      // جدول السجلات
      certificates: '', // جدول الشواهد
      tasks: ''         // جدول المهام، إن وُجد
    },
    columns: {
      userName: '', userRole: '', userSchool: '',
      schoolName: '', schoolCity: '',
      recordTitle: '', recordStatus: '', recordOwner: '', recordDesc: '', recordNotes: ''
    }
  };

  let client = null;

  // يُستدعى من المنصة الحالية بالعميل الذي أنشأته بالفعل
  function attach(supabaseClient){ client = supabaseClient; }

  const ready = () => !!client && Object.values(CONFIG.tables).every(Boolean);

  // تُعيد دائمًا مصفوفة، وتُعيد [] عند عدم الجاهزية، فتظهر الحالات الفارغة في الشاشات
  async function select(table, filters = {}){
    if (!ready() || !table) return [];
    let q = client.from(table).select('*');
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) { console.error('Shawahid query failed', error); return []; }
    return data || [];
  }

  // تحويل صفوف النظام إلى الشكل الذي تتوقعه شاشات شواهد
  function toRecord(row, i){
    const c = CONFIG.columns;
    return {
      id: row.id,
      no: i + 1,
      title: row[c.recordTitle],
      status: row[c.recordStatus] || 'draft',
      desc: row[c.recordDesc] || '',
      notes: row[c.recordNotes] || '',
      files: []
    };
  }

  async function loadTeacherRecords(userId){
    const rows = await select(CONFIG.tables.records, {[CONFIG.columns.recordOwner]: userId});
    return rows.map(toRecord);
  }

  return { CONFIG, attach, ready, select, toRecord, loadTeacherRecords };
})();

window.ShawahidAdapter = ShawahidAdapter;