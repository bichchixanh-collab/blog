// i18n gọn 1 file: chỉ dịch UI cứng (nút, nhãn, form). Nội dung bài đăng giữ nguyên như admin viết (VI hoặc ID).
// Cách dùng: <tag data-i18n="nav_home">⌂ Trang chủ</tag>, <input data-i18n-ph="search_ph">
// Đổi ngôn ngữ: I18N.setLang('id') — lưu localStorage j2me_lang, tự apply lại, không reload.
(function(){
  const DICT={
    vi:{nav_home:'⌂ Trang chủ',nav_cat:'≡ Thể loại',nav_hot:'★ Hot',nav_new:'Mới nhất',nav_vi:'Việt Hóa',nav_profile:'♡ Hồ sơ',search_ph:'Tìm game: asphalt, avatar...',search_btn:'Tìm',screen:'📱 Màn hình:',all:'Tất cả',hot_week:'♡ Game Hot Nhất Tuần',new_update:'★ Mới Cập Nhật',guide:'❓ Hướng dẫn',guide_text:'Chọn đúng độ phân giải → Bấm ⬇ Tải JAR → Copy vào thẻ nhớ → Cài đặt. Không cần giải nén.',cmt_title:'★ Đánh giá & Bình luận',cmt_new:'Có bình luận mới — bấm để tải lại',cmt_name:'Tên của bạn *',cmt_text:'Nhận xét về game... (hiện sau khi duyệt) *',cmt_send:'Gửi bình luận',cmt_loading:'Đang tải bình luận...',cmt_reviews:'đánh giá',cmt_page:'trang',cmt_empty:'Chưa có đánh giá nào. Hãy là người đầu tiên!',cmt_empty_page:'Trang này chưa có bình luận.',cmt_err:'Không tải được bình luận lúc này.',cmt_reply:'↳ Trả lời',cmt_replying:'Đang trả lời',dl:'⬇ Tải JAR',detail:'Chi tiết »',install:'Cài app về máy',music:'🎵 Nhạc',lite:'📴 Nhẹ'},
    id:{nav_home:'⌂ Beranda',nav_cat:'≡ Kategori',nav_hot:'★ Populer',nav_new:'Terbaru',nav_vi:'Vietnam',nav_profile:'♡ Profil',search_ph:'Cari game: asphalt, avatar...',search_btn:'Cari',screen:'📱 Layar:',all:'Semua',hot_week:'♡ Game Terpopuler Minggu Ini',new_update:'★ Baru Diperbarui',guide:'❓ Panduan',guide_text:'Pilih resolusi yang benar → Tekan ⬇ Unduh JAR → Salin ke kartu memori → Instal. Tanpa ekstrak.',cmt_title:'★ Ulasan & Komentar',cmt_new:'Ada komentar baru — ketuk untuk muat ulang',cmt_name:'Nama Anda *',cmt_text:'Ulasan tentang game... (tampil setelah disetujui) *',cmt_send:'Kirim komentar',cmt_loading:'Memuat komentar...',cmt_reviews:'ulasan',cmt_page:'halaman',cmt_empty:'Belum ada ulasan. Jadilah yang pertama!',cmt_empty_page:'Halaman ini belum ada komentar.',cmt_err:'Gagal memuat komentar saat ini.',cmt_reply:'↳ Balas',cmt_replying:'Membalas',dl:'⬇ Unduh JAR',detail:'Detail »',install:'Instal aplikasi',music:'🎵 Musik',lite:'📴 Hemat'}
  };
  function lang(){ try{ const v=localStorage.getItem('j2me_lang'); if(v==='id'||v==='vi') return v; }catch(e){} return 'vi'; }
  function t(k){ const l=lang(); return (DICT[l]&&DICT[l][k])||DICT.vi[k]||k; }
  function apply(){
    const l=lang();
    try{ document.documentElement.lang=(l==='id')?'id':'vi'; }catch(e){}
    document.querySelectorAll('[data-i18n]').forEach(el=>{ const v=t(el.getAttribute('data-i18n')); if(v) el.textContent=v; });
    document.querySelectorAll('[data-i18n-ph]').forEach(el=>{ const v=t(el.getAttribute('data-i18n-ph')); if(v) el.placeholder=v; });
    const sw=document.getElementById('langSwitch'); if(sw) sw.textContent=(l==='vi')?'🇮🇩 ID':'🇻🇳 VI';
  }
  function setLang(v){ if(v!=='vi'&&v!=='id') return; try{ localStorage.setItem('j2me_lang',v); }catch(e){} apply(); try{ if(typeof loadComments==='function'&&window.CMT_GAME){ loadComments(window.CMT_GAME, window.CMT_PAGE||1); } }catch(e){} }
  function inject(){
    if(document.getElementById('langSwitch')) return;
    const b=document.createElement('button'); b.id='langSwitch'; b.title='VI / ID';
    b.style.cssText='position:fixed;left:10px;bottom:10px;z-index:9998;background:#fff;border:1.5px solid #81c7f0;border-radius:20px;padding:6px 10px;font-size:11px;font-weight:700;color:#0066cc;cursor:pointer;box-shadow:0 4px 12px rgba(0,102,204,.25)';
    b.onclick=function(){ setLang(lang()==='vi'?'id':'vi'); };
    document.body.appendChild(b); apply();
  }
  window.I18N={t,lang,setLang,apply,inject};
  document.addEventListener('DOMContentLoaded',function(){ apply(); inject(); });
})();
