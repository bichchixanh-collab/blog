<?php
// Cookie session an toàn hơn (chống đọc trộm qua JS / gửi kèm site khác)
session_set_cookie_params(['lifetime'=>0,'path'=>'/','httponly'=>true,'samesite'=>'Lax']);
session_start();
$config = file_exists(__DIR__.'/config.php') ? include __DIR__.'/config.php' : (file_exists(__DIR__.'/config.example.php') ? include __DIR__.'/config.example.php' : []);
$dataFile = __DIR__.'/data/games.json';
$bakDir = __DIR__.'/data/backups';
$upDir = __DIR__.'/assets/uploads';
// Đổi sang mật khẩu hash 1 lần bằng lệnh: php -r "echo password_hash('MAT_KHAU_MOI', PASSWORD_DEFAULT), PHP_EOL;"
// rồi dán chuỗi nhận được vào ADMIN_PASS trong config.php thay cho mật khẩu thường.

// --- Auth ---
if (!isset($_SESSION['admin_logged'])) $_SESSION['admin_logged'] = false;
$msg = ''; $msgType='';

if (!isset($_SESSION['fails'])) $_SESSION['fails']=0;
if (!isset($_SESSION['locked_until'])) $_SESSION['locked_until']=0;
if (isset($_POST['login'])) {
    if (time() < $_SESSION['locked_until']) {
        $wait = (int)ceil(($_SESSION['locked_until']-time())/60);
        $msg="Sai quá nhiều lần. Thử lại sau $wait phút."; $msgType='error';
    } else {
        $u = $_POST['username'] ?? '';
        $p = $_POST['password'] ?? '';
        $stored = $config['ADMIN_PASS'] ?? '';
        // Hỗ trợ cả mật khẩu hash (khuyên dùng) lẫn mật khẩu thường (cũ)
        $passOk = (strpos($stored,'$2y$')===0||strpos($stored,'$argon2')===0)
            ? password_verify($p,$stored)
            : hash_equals((string)$stored,(string)$p);
        if ($u === ($config['ADMIN_USER'] ?? '') && $passOk) {
            session_regenerate_id(true);
            $_SESSION['admin_logged']=true;
            $_SESSION['login_time']=time();
            $_SESSION['fails']=0; $_SESSION['locked_until']=0;
            header('Location: admin.php'); exit;
        } else {
            $_SESSION['fails']++;
            if ($_SESSION['fails']>=5) { $_SESSION['locked_until']=time()+300; $_SESSION['fails']=0; $msg='Sai quá nhiều lần. Khóa đăng nhập 5 phút.'; }
            else $msg='Sai tài khoản/mật khẩu! (lần '.(int)$_SESSION['fails'].'/5)';
            $msgType='error';
        }
    }
}
if (isset($_GET['logout'])) { $_SESSION['admin_logged']=false; header('Location: admin.php'); exit; }
// Tự đăng xuất sau 2 giờ
if (!empty($_SESSION['admin_logged']) && (time()-($_SESSION['login_time']??0))>7200) {
    $_SESSION['admin_logged']=false;
    $msg='Phiên đăng nhập hết hạn (2 giờ). Hãy đăng nhập lại.'; $msgType='error';
}

if (!$_SESSION['admin_logged']) {
    // show login
    ?>
<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Login - JAVA.WAP.SH</title>
<style>*{box-sizing:border-box}body{font-family:system-ui;background:#eef2f7;display:grid;place-items:center;min-height:100vh;margin:0}
.box{background:#fff;border:1px solid #a8b5c8;border-radius:8px;padding:24px;width:340px;box-shadow:0 4px 16px rgba(0,0,0,.1)}
h2{margin:0 0 12px;color:#2b5da8;text-align:center}
input{width:100%;padding:10px;border:1px solid #a8b5c8;border-radius:6px;margin:6px 0}
button{width:100%;padding:10px;background:#2b5da8;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;margin-top:8px}
.err{background:#ffe0e0;color:#a00;padding:8px;border-radius:6px;font-size:13px;margin-bottom:8px;text-align:center}
small{color:#5a6b87;font-size:11px;display:block;text-align:center;margin-top:8px}
</style></head><body>
<div class="box">
<h2>☺ JAVA.WAP.SH ADMIN</h2>
<?php if($msg) echo "<div class='err'>$msg</div>"; ?>
<form method="post">
<input name="username" placeholder="Tài khoản" required value="admin">
<input type="password" name="password" placeholder="Mật khẩu" required>
<button type="submit" name="login">Đăng nhập</button>
</form>
<small>Chạy trên XAMPP - Token GitHub không bao giờ rời khỏi PC</small>
</div></body></html>
    <?php exit;
}

// Xuất toàn bộ games.json (chỉ khi đã đăng nhập)
if (!empty($_SESSION['admin_logged']) && isset($_GET['export']) && $_GET['export']==='json') {
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="games-'.date('Ymd-His').'.json"');
    echo file_exists($dataFile) ? file_get_contents($dataFile) : '[]';
    exit;
}

// --- Helpers ---
function loadGames($file){
    if (!file_exists($file)) return [];
    $j = file_get_contents($file);
    $a = json_decode($j, true);
    return is_array($a) ? $a : [];
}
function saveGamesLocal($file, $games){
    file_put_contents($file, json_encode($games, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
}
function cmt_norm($s){
    $s = mb_strtolower((string)$s, 'UTF-8');
    $map=['á'=>'a','à'=>'a','ả'=>'a','ã'=>'a','ạ'=>'a','ă'=>'a','ắ'=>'a','ằ'=>'a','ẳ'=>'a','ẵ'=>'a','ặ'=>'a','â'=>'a','ấ'=>'a','ầ'=>'a','ẩ'=>'a','ẫ'=>'a','ậ'=>'a','é'=>'e','è'=>'e','ẻ'=>'e','ẽ'=>'e','ẹ'=>'e','ê'=>'e','ế'=>'e','ề'=>'e','ể'=>'e','ễ'=>'e','ệ'=>'e','í'=>'i','ì'=>'i','ỉ'=>'i','ĩ'=>'i','ị'=>'i','ó'=>'o','ò'=>'o','ỏ'=>'o','õ'=>'o','ọ'=>'o','ô'=>'o','ố'=>'o','ồ'=>'o','ổ'=>'o','ỗ'=>'o','ộ'=>'o','ơ'=>'o','ớ'=>'o','ờ'=>'o','ở'=>'o','ỡ'=>'o','ợ'=>'o','ú'=>'u','ù'=>'u','ủ'=>'u','ũ'=>'u','ụ'=>'u','ư'=>'u','ứ'=>'u','ừ'=>'u','ử'=>'u','ữ'=>'u','ự'=>'u','ý'=>'y','ỳ'=>'y','ỷ'=>'y','ỹ'=>'y','ỵ'=>'y','đ'=>'d'];
    $s = strtr($s, $map);
    $s = preg_replace('/[^a-z0-9]+/', ' ', $s);
    return trim(preg_replace('/\s+/', ' ', $s));
}
function cmt_load_banned(){
    global $config;
    $got = githubGetFile($config, 'data/banned_words.json');
    if (!$got['error'] && is_array($got['data'])) return array_values(array_filter(array_map(fn($s)=>trim((string)$s), $got['data'])));
    $local = __DIR__.'/data/banned_words.json';
    if (file_exists($local)) { $j=json_decode(@file_get_contents($local), true); if(is_array($j)) return $j; }
    return [];
}
// Cấu hình kiểm duyệt (data/moderate_config.json): admin bật/tắt auto + AI tại đây,
// không cần động vào env Vercel. Key OpenAI vẫn nằm ở env (bí mật).
function cmt_default_config(){ return ['auto_approve'=>true,'ai_enabled'=>false,'threshold'=>0.75]; }
function cmt_load_config(){
    global $config;
    $got = githubGetFile($config, 'data/moderate_config.json');
    if (!$got['error'] && is_array($got['data'])) {
        $d = $got['data'];
        return [
            'auto_approve' => ($d['auto_approve'] ?? true) !== false,
            'ai_enabled' => ($d['ai_enabled'] ?? false) === true,
            'threshold' => min(0.99, max(0.1, (float)($d['threshold'] ?? 0.75))),
        ];
    }
    $local = __DIR__.'/data/moderate_config.json';
    if (file_exists($local)) {
        $j=json_decode(@file_get_contents($local), true);
        if(is_array($j)) return [
            'auto_approve' => ($j['auto_approve'] ?? true) !== false,
            'ai_enabled' => ($j['ai_enabled'] ?? false) === true,
            'threshold' => min(0.99, max(0.1, (float)($j['threshold'] ?? 0.75))),
        ];
    }
    return cmt_default_config();
}
function cmt_check($text, $name=''){
    $t = trim((string)$text); $n = trim((string)$name);
    if(mb_strlen($t)<2) return ['ok'=>false,'reason'=>'quá ngắn'];
    if(mb_strlen($t)>500) return ['ok'=>false,'reason'=>'quá dài'];
    $urlRe='/(https?:\/\/|www\.)|([a-z0-9-]+\.(com|net|org|info|xyz|top|click|shop|online|site|tech|store|me|cc|io|co|link|live|fun|pro|app|dev|icu|vip|art|blog|cloud|asia|biz|vn|com\.vn)\b)/i';
    if(preg_match($urlRe,$t) || preg_match($urlRe,$n)) return ['ok'=>false,'reason'=>'chứa URL/link'];
    if(preg_match('/\b0\d{9,10}\b|(\+84|84)[\s.-]?\d{8,10}/',$t)) return ['ok'=>false,'reason'=>'chứa số điện thoại'];
    if(preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i',$t)) return ['ok'=>false,'reason'=>'chứa email'];
    global $bannedWords;
    if (!isset($bannedWords) || !is_array($bannedWords)) $bannedWords = cmt_load_banned();
    $banned = $bannedWords;
    $normT=cmt_norm($t); $normN=cmt_norm($n);
    foreach($banned as $w){
        $w=cmt_norm($w); if($w==='') continue;
        $esc = preg_quote($w,'/');
        $esc = preg_replace('/\s+/', '\\s+', $esc);
        if(preg_match('/\b'.$esc.'\b/',$normT) || preg_match('/\b'.$esc.'\b/',$normN))
            return ['ok'=>false,'reason'=>"từ cấm: $w"];
    }
    if(preg_match('/(.)\1{5,}/',$t)) return ['ok'=>false,'reason'=>'spam: ký tự lặp'];
    $words=preg_split('/\s+/', mb_strtolower($t)); $cnt=[];
    foreach($words as $w){ if($w==='')continue; $cnt[$w]=($cnt[$w]??0)+1; if($cnt[$w]>=6) return ['ok'=>false,'reason'=>'spam: lặp từ']; }
    if(mb_strlen($t)>=10 && $t===mb_strtoupper($t) && preg_match('/[A-Z]/',$t)) return ['ok'=>false,'reason'=>'spam: viết hoa toàn bộ'];
    $special=preg_match_all('/[^a-zA-Z0-9\s\x{00C0}-\x{024F}]/u',$t,$m);
    if(mb_strlen($t)>20 && $special/mb_strlen($t)>0.4) return ['ok'=>false,'reason'=>'spam: nhiều ký tự đặc biệt'];
    // Kém chất lượng: quá ngắn / chung chung (gương economy bonusEligible)
    if(mb_strlen($t,'UTF-8')<12) return ['ok'=>false,'reason'=>'quá ngắn / kém chất lượng (cần ≥12 ký tự)'];
    preg_match_all('/[A-Za-zÀ-ỹđ]/u',$t,$lm);
    if(count($lm[0])/max(1,mb_strlen($t,'UTF-8'))<0.4) return ['ok'=>false,'reason'=>'nội dung không rõ nghĩa'];
    $w2=preg_split('/\s+/u', trim($t)); $w2=array_filter($w2,fn($x)=>$x!=='');
    if(count($w2)<=2 && mb_strlen($t,'UTF-8')<=20) return ['ok'=>false,'reason'=>'quá ngắn / chung chung'];
    return ['ok'=>true,'reason'=>''];
}
function csrf_token(){ if(empty($_SESSION['csrf'])) $_SESSION['csrf']=bin2hex(random_bytes(32)); return $_SESSION['csrf']; }
function csrf_field(){ return '<input type="hidden" name="csrf" value="'.htmlspecialchars(csrf_token()).'">'; }
function check_csrf(){ return isset($_POST['csrf']) && hash_equals($_SESSION['csrf']??'', (string)$_POST['csrf']); }
// Backup games.json trước mỗi lần thay đổi, chỉ giữ 10 bản mới nhất
function add_backup($dataFile,$bakDir){
    if(!file_exists($dataFile)) return;
    if(!is_dir($bakDir)) @mkdir($bakDir,0755,true);
    @copy($dataFile,$bakDir.'/games-'.date('Ymd-His').'.json');
    $fs=glob($bakDir.'/games-*.json')?:[]; rsort($fs);
    foreach(array_slice($fs,10) as $old) @unlink($old);
}
function list_backups($bakDir){ $fs=glob($bakDir.'/games-*.json')?:[]; rsort($fs); return $fs; }
// Nhận 1 file ảnh upload: trả về đường dẫn tương đối (assets/uploads/...), null nếu không có file, false nếu lỗi (xem $err)
function save_upload($f,$upDir,&$err){
    if(!isset($f)||($f['error']??UPLOAD_ERR_NO_FILE)===UPLOAD_ERR_NO_FILE) return null;
    if($f['error']!==UPLOAD_ERR_OK){$err='Lỗi upload file.';return false;}
    if($f['size']>3*1024*1024){$err='Ảnh vượt quá 3MB.';return false;}
    $info=@getimagesize($f['tmp_name']); if(!$info){$err='File không phải ảnh.';return false;}
    $map=[IMAGETYPE_JPEG=>'jpg',IMAGETYPE_PNG=>'png',IMAGETYPE_GIF=>'gif',IMAGETYPE_WEBP=>'webp'];
    if(!isset($map[$info[2]])){$err='Chỉ nhận ảnh JPG/PNG/GIF/WebP.';return false;}
    if(!is_dir($upDir)) @mkdir($upDir,0755,true);
    $name='up_'.date('Ymd_His').'_'.bin2hex(random_bytes(4)).'.'.$map[$info[2]];
    if(!move_uploaded_file($f['tmp_name'],$upDir.'/'.$name)){$err='Không lưu được file upload.';return false;}
    return 'assets/uploads/'.$name;
}
function githubSync($config, $games, &$outMsg){
    if (empty($config['GITHUB_TOKEN']) || empty($config['GITHUB_REPO'])) {
        $outMsg = '⚠️ Chưa cấu hình GITHUB_TOKEN/REPO trong config.php - chỉ lưu local.';
        return false;
    }
    $repo = $config['GITHUB_REPO'];
    $path = $config['GITHUB_PATH'] ?? 'data/games.json';
    $branch = $config['GITHUB_BRANCH'] ?? 'main';
    $token = $config['GITHUB_TOKEN'];
    $api = "https://api.github.com/repos/$repo/contents/$path";

    // GET sha - dùng Bearer cho fine-grained, fallback token cho classic
    $ch = curl_init($api."?ref=$branch");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_HTTPHEADER=>["Authorization: Bearer $token","User-Agent: php-admin","Accept: application/vnd.github.v3+json"]]);
    $res = curl_exec($ch); $code=curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $sha = null;
    if ($code===200) {
        $j=json_decode($res,true); $sha=$j['sha'] ?? null;
    } elseif ($code!==404) {
        $outMsg="❌ Lỗi lấy SHA từ GitHub ($code): $res";
        return false;
    }
    $content = base64_encode(json_encode($games, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
    $payload = json_encode(['message'=>"update games ".date('Y-m-d H:i:s'), 'content'=>$content, 'branch'=>$branch] + ($sha?['sha'=>$sha]:[]));
    $ch=curl_init($api);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_CUSTOMREQUEST=>'PUT', CURLOPT_POSTFIELDS=>$payload,
        CURLOPT_HTTPHEADER=>["Authorization: Bearer $token","User-Agent: php-admin","Content-Type: application/json","Accept: application/vnd.github.v3+json"]]);
    $res=curl_exec($ch); $code=curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($code===200 || $code===201) { $outMsg="✅ Đã đồng bộ lên GitHub & Vercel sẽ deploy trong ~30s."; return true; }
    $outMsg="❌ Lỗi push GitHub ($code): ".htmlspecialchars(substr($res,0,800));
    return false;
}
// Đọc 1 file JSON bất kỳ trên repo (dùng cho bình luận, thống kê...). Trả về [data, sha].
function githubGetFile($config, $repoPath){
    $out=['data'=>null,'sha'=>null,'error'=>''];
    if (empty($config['GITHUB_TOKEN']) || empty($config['GITHUB_REPO'])) { $out['error']='Chưa cấu hình GITHUB_TOKEN/REPO.'; return $out; }
    $repo=$config['GITHUB_REPO']; $branch=$config['GITHUB_BRANCH'] ?? 'main'; $token=$config['GITHUB_TOKEN'];
    $ch=curl_init("https://api.github.com/repos/$repo/contents/$repoPath?ref=$branch");
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>["Authorization: Bearer $token","User-Agent: php-admin","Accept: application/vnd.github.v3+json"]]);
    $res=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    if($code===200){
        $j=json_decode($res,true);
        $out['data']=json_decode(base64_decode($j['content']??''),true);
        $out['sha']=$j['sha']??null;
    } elseif($code===404){ $out['data']=null; }
    else{ $out['error']="Lỗi đọc $repoPath từ GitHub ($code)."; }
    return $out;
}
// Ghi 1 file bất kỳ lên repo (cần sha hiện tại, chống ghi đè xung đột).
// $data là mảng (tự json_encode) hoặc chuỗi thô khi $isRaw=true (vd sitemap.xml).
function githubPutFile($config, $repoPath, $data, $commitMsg, &$outMsg, $isRaw=false){
    if (empty($config['GITHUB_TOKEN']) || empty($config['GITHUB_REPO'])) { $outMsg='Chưa cấu hình GITHUB_TOKEN/REPO.'; return false; }
    $repo=$config['GITHUB_REPO']; $branch=$config['GITHUB_BRANCH'] ?? 'main'; $token=$config['GITHUB_TOKEN'];
    $cur=githubGetFile($config,$repoPath);
    if($cur['error']){ $outMsg='❌ '.$cur['error']; return false; }
    $payload=json_encode(['message'=>$commitMsg,'content'=>base64_encode($isRaw?$data:json_encode($data,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)),'branch'=>$branch]+($cur['sha']?['sha'=>$cur['sha']]:[]));
    $ch=curl_init("https://api.github.com/repos/$repo/contents/$repoPath");
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>'PUT',CURLOPT_POSTFIELDS=>$payload,
        CURLOPT_HTTPHEADER=>["Authorization: Bearer $token","User-Agent: php-admin","Content-Type: application/json","Accept: application/vnd.github.v3+json"]]);
    $res=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    if($code===200||$code===201){ $outMsg='✅ Đã lưu lên GitHub.'; return true; }
    $outMsg='❌ Lỗi ghi GitHub ($code): '.htmlspecialchars(substr($res,0,300));
    return false;
}
if(file_exists(__DIR__.'/sitemap_lib.php')) require_once __DIR__.'/sitemap_lib.php';
// Dự phòng khi thiếu sitemap_lib.php (file này chưa từng được commit): dựng sitemap
// tối thiểu để trang admin không fatal, flow đăng bài vẫn chạy.
if(!function_exists('build_sitemap_xml')){
    function build_sitemap_xml($games){
        $x='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        $x.='<url><loc>https://j2me.vercel.app/</loc><changefreq>daily</changefreq></url>';
        $x.='<url><loc>https://j2me.vercel.app/category.html</loc><changefreq>weekly</changefreq></url>';
        if(is_array($games)) foreach($games as $g){
            $id=preg_replace('/[^a-z0-9\-]/i','',strval($g['id']??''));
            if($id==='')continue;
            $x.='<url><loc>https://j2me.vercel.app/game/'.htmlspecialchars($id).'.html</loc><changefreq>weekly</changefreq></url>';
        }
        return $x.'</urlset>';
    }
}
if (!function_exists('lock_secret')){ function lock_secret(){ $s=getenv('LOCK_SECRET'); if($s && strlen($s)>=16) return $s; global $config; $c=$config['LOCK_SECRET']??null; return $c && strlen($c)>=16 ? $c : null; } }
// Ping Google/Bing báo sitemap mới (không chặn, lỗi thì bỏ qua).
function ping_sitemap(){
    $sm=rawurlencode('https://j2me.vercel.app/sitemap.xml');
    foreach(['https://www.google.com/ping?sitemap='.$sm,'https://www.bing.com/ping?sitemap='.$sm] as $u){
        try{ @file_get_contents($u,false,stream_context_create(['http'=>['timeout'=>5,'ignore_errors'=>true]])); }catch(Exception $e){}
    }
}
// Dựng lại sitemap từ $games hiện tại: luôn ghi file local, đẩy GitHub nếu có token.
// Lỗi sitemap không làm hỏng flow chính (chỉ thêm ghi chú vào $note).
function refresh_sitemap($games,$config){
    $xml=build_sitemap_xml($games);
    @file_put_contents(__DIR__.'/sitemap.xml',$xml);
    if(empty($config['GITHUB_TOKEN'])||empty($config['GITHUB_REPO'])) return 'Sitemap local đã cập nhật (chưa đẩy GitHub: thiếu token).';
    $m='';
    $ok=githubPutFile($config,'sitemap.xml',$xml,'update sitemap '.date('Y-m-d H:i:s'),$m,true);
    if($ok) ping_sitemap();
    return $ok?'Sitemap đã cập nhật + đẩy GitHub + ping công cụ tìm kiếm.':'Sitemap local đã cập nhật; đẩy GitHub lỗi: '.strip_tags($m);
}

// --- Handle CRUD ---
$games = loadGames($dataFile);
$editId = $_GET['edit'] ?? '';
$editGame = null;
if ($editId) {
    foreach($games as $g) if($g['id']===$editId) $editGame=$g;
}

// Delete (POST + CSRF, chống xóa nhầm qua link)
if (isset($_POST['delete'])) {
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ. Tải lại trang rồi thử lại.'; $msgType='error'; }
    else{
        $delId=(string)($_POST['delete']??'');
        $games=array_values(array_filter($games, fn($g)=>$g['id']!==$delId));
        add_backup($dataFile,$bakDir);
        saveGamesLocal($dataFile, $games);
        $syncMsg=''; githubSync($config,$games,$syncMsg);
        $msg="Đã xóa $delId. $syncMsg"; $msgType='success';
        $msg.='<br><small>• Sitemap: '.htmlspecialchars(refresh_sitemap($games,$config)).'</small>';
        $editGame=null; $editId='';
    }
}

// Save (add/update) - SEO slug .html
if (isset($_POST['save'])) {
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ. Tải lại trang rồi thử lại.'; $msgType='error'; }
    else{
    $id = trim($_POST['id'] ?? '');
    if (!$id) {
        $base = trim($_POST['name'] ?? 'game');
        $map = ['á'=>'a','à'=>'a','ả'=>'a','ã'=>'a','ạ'=>'a','ă'=>'a','ắ'=>'a','ằ'=>'a','ẳ'=>'a','ẵ'=>'a','ặ'=>'a','â'=>'a','ấ'=>'a','ầ'=>'a','ẩ'=>'a','ẫ'=>'a','ậ'=>'a','é'=>'e','è'=>'e','ẻ'=>'e','ẽ'=>'e','ẹ'=>'e','ê'=>'e','ế'=>'e','ề'=>'e','ể'=>'e','ễ'=>'e','ệ'=>'e','í'=>'i','ì'=>'i','ỉ'=>'i','ĩ'=>'i','ị'=>'i','ó'=>'o','ò'=>'o','ỏ'=>'o','õ'=>'o','ọ'=>'o','ô'=>'o','ố'=>'o','ồ'=>'o','ổ'=>'o','ỗ'=>'o','ộ'=>'o','ơ'=>'o','ớ'=>'o','ờ'=>'o','ở'=>'o','ỡ'=>'o','ợ'=>'o','ú'=>'u','ù'=>'u','ủ'=>'u','ũ'=>'u','ụ'=>'u','ư'=>'u','ứ'=>'u','ừ'=>'u','ử'=>'u','ữ'=>'u','ự'=>'u','ý'=>'y','ỳ'=>'y','ỷ'=>'y','ỹ'=>'y','ỵ'=>'y','đ'=>'d','Á'=>'a','À'=>'a','Ả'=>'a','Ã'=>'a','Ạ'=>'a','Ă'=>'a','Â'=>'a','É'=>'e','È'=>'e','Ê'=>'e','Í'=>'i','Ì'=>'i','Ó'=>'o','Ò'=>'o','Ô'=>'o','Ơ'=>'o','Ú'=>'u','Ù'=>'u','Ư'=>'u','Ý'=>'y','Đ'=>'d'];
        $base = strtr(mb_strtolower($base,'UTF-8'), $map);
        $id = preg_replace('/[^a-z0-9]+/','-', $base);
        $id = trim($id, '-');
        if (!$id) $id = 'game';
        $orig=$id; $n=2; $ids=array_column($games,'id');
        while(in_array($id,$ids) && (!isset($editGame) || $editGame['id']!==$id)){ $id=$orig.'-'.$n; $n++; if($n>99) break; }
    }
    $id = preg_replace('/[^a-z0-9\-]/','', strtolower($id));
    $resArr = $_POST['res'] ?? [];
    if (!is_array($resArr)) $resArr=[$resArr];
    $jar=[];
    foreach($resArr as $r){ $jar[$r]=trim($_POST["jar_$r"] ?? '#'); }
    // Upload ảnh thumb + screenshot (gộp với URL nhập tay)
    $upErr='';
    $upThumb=save_upload($_FILES['thumb_file']??null,$upDir,$upErr);
    if($upThumb===false){ $msg=$upErr; $msgType='error'; }
    else{
        $thumb = $upThumb ?: trim($_POST['thumb'] ?? '');
        if($thumb==='' && $editGame) $thumb=$editGame['thumb']??'';
        $shotsRaw = trim($_POST['shots'] ?? '');
        $shots = $shotsRaw ? array_values(array_filter(array_map('trim', explode("\n", str_replace(',',"\n",$shotsRaw))))) : [];
        if(!empty($_FILES['shots_files']['name'][0])){
            $n=count($_FILES['shots_files']['name']);
            for($si=0;$si<$n;$si++){
                $one=['name'=>$_FILES['shots_files']['name'][$si],'type'=>$_FILES['shots_files']['type'][$si],'tmp_name'=>$_FILES['shots_files']['tmp_name'][$si],'error'=>$_FILES['shots_files']['error'][$si],'size'=>$_FILES['shots_files']['size'][$si]];
                $p=save_upload($one,$upDir,$upErr);
                if($p===false) break;
                if($p) $shots[]=$p;
            }
        }
        if($upErr){ $msg=$upErr; $msgType='error'; }
        else{
            $shots=array_values(array_unique($shots));
            // Thời gian đăng: giữ nguyên khi sửa; luôn cập nhật "sửa lần cuối"; giữ lượt tải cũ
            // Khóa tải: admin đặt điều kiện, người xem đủ mới bấm Tải được (khóa mềm, xem docs trong dl.js)
            $gateTypes = ['none','xp','stats','login'];
            $gateType = $_POST['gate_type'] ?? 'none';
            if (!in_array($gateType, $gateTypes, true)) $gateType = 'none';
            $gate = ['type' => $gateType,
                'xp' => max(1, (int)($_POST['gate_xp'] ?? 100))];
            if ($gateType === 'stats') {
                // Mỗi điều kiện tách riêng, tích nhiều = phải đủ TẤT CẢ (AND)
                $rq = [];
                if (isset($_POST['rq_read_on'])) $rq['read'] = max(1, min(3600, (int)($_POST['rq_read'] ?? 10)));
                if (isset($_POST['rq_likes_on'])) $rq['likes'] = max(1, min(10000, (int)($_POST['rq_likes'] ?? 5)));
                if (isset($_POST['rq_completed_on'])) $rq['completed'] = max(1, min(10000, (int)($_POST['rq_completed'] ?? 3)));
                if (!$rq) $gateType = 'none'; // không tick gì = mở tự do
                $gate = ['type' => $gateType, 'require' => $rq];
            }
            if ($gateType !== 'none' && isset($_POST['gate_login'])) $gate['login'] = 1;
            // Giá tải EXP (admin set tùy ý; tải lại game đã sở hữu thì miễn phí)
            // + thời gian đọc bài (giây, mặc định 10) để mở tải
            $dlCost = max(0, min(100000, (int)($_POST['dl_cost'] ?? 10)));
            $readSecs = max(1, min(3600, (int)($_POST['read_secs'] ?? 10)));
            $voluntary = ['fog'=>isset($_POST['vol_fog'])?1:0];
            $createdAt = $editGame['created_at'] ?? date('c');
            $g = [
                'id'=>$id,
                'name'=>trim($_POST['name'] ?? ''),
                'cat'=>trim($_POST['cat'] ?? ''),
                'size'=>trim($_POST['size'] ?? ''),
                'res'=>$resArr,
                'hot'=>isset($_POST['hot']),
                'vi'=>isset($_POST['vi']),
                'new'=>isset($_POST['new']),
                'gate'=>$gate,
                'dl_cost'=>$dlCost,
                'read_secs'=>$readSecs,
                'voluntary'=>$voluntary,
                'desc'=>trim($_POST['desc'] ?? ''),
                'thumb'=>$thumb,
                'shots'=>$shots,
                'jar'=>$jar,
                'downloads'=>($editGame['downloads'] ?? 0),
                'created_at'=>$createdAt,
                'updated_at'=>date('c'),
            ];
            if (!$g['name']) { $msg='Tên game bắt buộc!'; $msgType='error'; }
            else {
                $found=false;
                foreach($games as $i=>$ex) if($ex['id']===$id){ $games[$i]=$g; $found=true; break; }
                if(!$found) array_unshift($games, $g);
                // Bài cũ thiếu ngày đăng thì gán giờ hiện tại, rồi xếp mới nhất lên đầu
                foreach($games as &$gm){ if(empty($gm['created_at'])) $gm['created_at']=date('c'); } unset($gm);
                usort($games, fn($a,$b)=>strcmp($b['created_at']??'', $a['created_at']??''));
                add_backup($dataFile,$bakDir);
                saveGamesLocal($dataFile, $games);
                $syncMsg=''; $ok=githubSync($config,$games,$syncMsg);
                $msg=($found?'Đã cập nhật':'Đã thêm')." <b>{$g['name']}</b>. $syncMsg"; $msgType=$ok?'success':'info';
                $msg.='<br><small>• Sitemap: '.htmlspecialchars(refresh_sitemap($games,$config)).'</small>';
                $editGame=null; $editId='';
            }
        }
    }
    }
}

// Manual sync button
if (isset($_POST['sync'])) {
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ. Tải lại trang rồi thử lại.'; $msgType='error'; }
    else{ $syncMsg=''; $ok=githubSync($config,$games,$syncMsg); $msg=$syncMsg; $msgType=$ok?'success':'error'; }
}

// Restore từ bản backup (POST + CSRF)
if (isset($_POST['restore'])) {
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ.'; $msgType='error'; }
    else{
        $f=basename((string)($_POST['restore']??''));
        $src=$bakDir.'/'.$f;
        if(!preg_match('/^games-\d{8}-\d{6}\.json$/',$f)||!file_exists($src)){ $msg='File backup không hợp lệ.'; $msgType='error'; }
        else{
            add_backup($dataFile,$bakDir);
            copy($src,$dataFile);
            $games=loadGames($dataFile);
            $syncMsg=''; $ok=githubSync($config,$games,$syncMsg);
            $msg="Đã khôi phục từ $f. $syncMsg"; $msgType=$ok?'success':'info';
            $msg.='<br><small>• Sitemap: '.htmlspecialchars(refresh_sitemap($games,$config)).'</small>';
            $editGame=null; $editId='';
        }
    }
}

// Import từ file JSON (POST + CSRF, tự backup trước khi thay)
if (isset($_POST['import'])) {
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ.'; $msgType='error'; }
    elseif(empty($_FILES['import_file'])||($_FILES['import_file']['error']??1)!==UPLOAD_ERR_OK){ $msg='Hãy chọn file JSON để import.'; $msgType='error'; }
    else{
        $imp=json_decode(@file_get_contents($_FILES['import_file']['tmp_name']),true);
        if(!is_array($imp)){ $msg='File JSON không hợp lệ.'; $msgType='error'; }
        else{
            $clean=[];
            foreach($imp as $it){
                if(!is_array($it)||empty($it['id'])||empty($it['name'])) continue;
                $it['res']=is_array($it['res']??null)?array_values($it['res']):[];
                $it['jar']=is_array($it['jar']??null)?$it['jar']:[];
                $it['shots']=is_array($it['shots']??null)?array_values($it['shots']):[];
                $it['hot']=!empty($it['hot']); $it['vi']=!empty($it['vi']); $it['new']=!empty($it['new']);
                $it['downloads']=(int)($it['downloads']??0);
                $gt=is_array($it['gate']??null)?$it['gate']:[];
                $gtT=in_array($gt['type']??'none',['none','xp','stats','login'],true)?$gt['type']:'none';
                $it['gate']=['type'=>$gtT,'xp'=>max(1,(int)($gt['xp']??100))];
                if($gtT==='stats'){ $rq=[]; if(isset($gt['require']['read']))$rq['read']=max(1,min(3600,(int)$gt['require']['read'])); if(isset($gt['require']['likes']))$rq['likes']=max(1,min(10000,(int)$gt['require']['likes'])); if(isset($gt['require']['completed']))$rq['completed']=max(1,min(10000,(int)$gt['require']['completed'])); $it['gate']['require']=$rq; }
                if(!empty($gt['login']))$it['gate']['login']=1;
                if(empty($it['created_at'])) $it['created_at']=date('c');
                $it['updated_at']=date('c');
                foreach(['cat','size','desc','thumb'] as $k) $it[$k]=(string)($it[$k]??'');
                $it['dl_cost']=max(0,min(100000,(int)($it['dl_cost']??10)));
                $it['read_secs']=max(1,min(3600,(int)($it['read_secs']??10)));
                $clean[]=$it;
            }
            if(!$clean){ $msg='Không có bài nào hợp lệ trong file.'; $msgType='error'; }
            else{
                add_backup($dataFile,$bakDir);
                $games=array_values($clean);
                usort($games, fn($a,$b)=>strcmp($b['created_at']??'', $a['created_at']??''));
                saveGamesLocal($dataFile, $games);
                $syncMsg=''; $ok=githubSync($config,$games,$syncMsg);
                $msg='Đã import '.count($clean).' game. '.$syncMsg; $msgType=$ok?'success':'info';
                $msg.='<br><small>• Sitemap: '.htmlspecialchars(refresh_sitemap($games,$config)).'</small>';
                $editGame=null; $editId='';
            }
        }
    }
}

// Thông báo ghim trang chủ (POST + CSRF): lưu local + đẩy data/notice.json
$noticeFile=__DIR__.'/data/notice.json';
$nj=json_decode(@file_get_contents($noticeFile),true);
$noticeCur=is_array($nj)?$nj:['text'=>'','updated_at'=>null];
if(isset($_POST['notice_save'])){
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ.'; $msgType='error'; }
    else{
        $nt=trim($_POST['notice_text']??'');
        $noticeCur=['text'=>$nt,'updated_at'=>$nt!==''?date('c'):null];
        @file_put_contents($noticeFile,json_encode($noticeCur,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
        if(!empty($config['GITHUB_TOKEN'])&&!empty($config['GITHUB_REPO'])){
            $m=''; $ok=githubPutFile($config,'data/notice.json',$noticeCur,'update notice '.date('Y-m-d H:i:s'),$m);
            $msg='Đã lưu thông báo. '.($ok?'Đã đẩy GitHub.':'Đẩy GitHub lỗi: '.strip_tags($m)); $msgType=$ok?'success':'error';
        } else { $msg='Đã lưu thông báo local (chưa đẩy GitHub: thiếu token).'; $msgType='info'; }
    }
}
// Tìm uid Supabase theo email (Auth Admin API, cần SUPABASE_SERVICE_KEY trong config.php)
function supa_find_uid_by_email($sbUrl, $sbKey, $email){
    $want = mb_strtolower(trim((string)$email), 'UTF-8');
    if ($want === '') return null;
    for ($page = 1; $page <= 20; $page++) {
        $ch = curl_init(rtrim($sbUrl, '/').'/auth/v1/admin/users?page='.$page.'&per_page=100');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => ["apikey: $sbKey", "Authorization: Bearer $sbKey"]]);
        $res = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code !== 200) return null;
        $j = json_decode($res, true);
        $users = (is_array($j) && isset($j['users']) && is_array($j['users'])) ? $j['users'] : (is_array($j) ? $j : []);
        if (!$users) return null;
        foreach ($users as $u) {
            if (is_array($u) && mb_strtolower((string)($u['email'] ?? ''), 'UTF-8') === $want) return (string)($u['id'] ?? '');
        }
        if (count($users) < 100) break;
    }
    return null;
}
// Cộng/đặt EXP ví cho tài khoản theo email (ghi data/economy.json, key u_<uid>)
$expLookup = null;
if (isset($_POST['exp_lookup']) || isset($_POST['exp_adjust'])) {
    if (!check_csrf()) { $msg = 'Token bảo mật không hợp lệ.'; $msgType = 'error'; }
    else {
        $expEmail = trim((string)($_POST['exp_email'] ?? ''));
        $sbUrl = rtrim((string)($config['SUPABASE_URL'] ?? 'https://pmotbltodyyilarnvtpn.supabase.co'), '/');
        $sbKey = (string)($config['SUPABASE_SERVICE_KEY'] ?? '');
        if (!filter_var($expEmail, FILTER_VALIDATE_EMAIL)) { $msg = 'Email không hợp lệ.'; $msgType = 'error'; }
        elseif ($sbKey === '') { $msg = 'Chưa cấu hình SUPABASE_SERVICE_KEY trong config.php nên không tra được uid theo email.'; $msgType = 'error'; }
        else {
            $expUid = supa_find_uid_by_email($sbUrl, $sbKey, $expEmail);
            if (!$expUid) { $msg = 'Không tìm thấy tài khoản với email này (chưa đăng ký?).'; $msgType = 'error'; }
            else {
                $eGot = githubGetFile($config, 'data/economy.json');
                if ($eGot['error']) { $msg = '❌ '.$eGot['error']; $msgType = 'error'; }
                else {
                    $emap = is_array($eGot['data']) ? $eGot['data'] : [];
                    $ek = 'u_'.$expUid;
                    $er = is_array($emap[$ek] ?? null) ? $emap[$ek] : [];
                    $bal = max(0, (int)($er['bal'] ?? 0));
                    if (isset($_POST['exp_adjust'])) {
                        $amt = (int)($_POST['exp_amount'] ?? 0);
                        $mode = ($_POST['exp_mode'] ?? 'add') === 'set' ? 'set' : 'add';
                        $newBal = ($mode === 'set') ? max(0, min(100000, $amt)) : max(0, min(100000, $bal + $amt));
                        $er['bal'] = $newBal;
                        if (!isset($er['last'])) $er['last'] = '';
                        if (!isset($er['streak'])) $er['streak'] = 0;
                        if (!isset($er['owned']) || !is_array($er['owned'])) $er['owned'] = [];
                        if (!isset($er['bonus']) || !is_array($er['bonus'])) $er['bonus'] = [];
                        $emap[$ek] = $er;
                        $eSync = '';
                        $ok = githubPutFile($config, 'data/economy.json', $emap, 'economy: manual '.$mode.' '.($mode === 'set' ? $newBal : (($amt >= 0 ? '+' : '').$amt)).' '.$ek, $eSync);
                        if ($ok) { $bal = $newBal; $msg = 'Đã '.($mode === 'set' ? 'đặt' : 'cộng').' EXP cho <b>'.htmlspecialchars($expEmail).'</b>: số dư <b>'.$bal.'</b>. '.$eSync; $msgType = 'success'; }
                        else { $msg = '❌ '.$eSync; $msgType = 'error'; }
                    }
                    $expLookup = ['email' => $expEmail, 'uid' => $expUid, 'bal' => $bal];
                }
            }
        }
    }
}
// Đổi mật khẩu admin (POST + CSRF): kiểm tra mật khẩu cũ, hash mật khẩu mới, ghi lại config.php
if(isset($_POST['change_pass'])){
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ.'; $msgType='error'; }
    else{
        $old=($_POST['old_pass']??''); $new1=($_POST['new_pass1']??''); $new2=($_POST['new_pass2']??'');
        $stored=$config['ADMIN_PASS'] ?? '';
        $okOld=(strpos($stored,'$2y$')===0||strpos($stored,'$argon2')===0)?password_verify($old,$stored):hash_equals((string)$stored,(string)$old);
        if(!$okOld){ $msg='Mật khẩu hiện tại không đúng.'; $msgType='error'; }
        elseif(mb_strlen($new1)<6){ $msg='Mật khẩu mới phải từ 6 ký tự.'; $msgType='error'; }
        elseif($new1!==$new2){ $msg='Nhập lại mật khẩu mới chưa khớp.'; $msgType='error'; }
        else{
            $cfgPath=__DIR__.'/config.php';
            @copy($cfgPath,$cfgPath.'.bak-'.date('Ymd-His'));
            $config['ADMIN_PASS']=password_hash($new1,PASSWORD_DEFAULT);
            $out="<?php\n// File local - KHONG commit len GitHub\nreturn ".var_export($config,true).";\n";
            if(@file_put_contents($cfgPath,$out)!==false){ $msg='Đã đổi mật khẩu (đã hash, đã backup config cũ). Hãy đăng nhập lại.'; $msgType='success'; $_SESSION['admin_logged']=false; header('Refresh:2; url=admin.php'); }
            else{ $msg='Không ghi được config.php (kiểm tra quyền file).'; $msgType='error'; }
        }
    }
}
// Duyệt bình luận + banned words + cấu hình kiểm duyệt
$cmtList=[]; $cmtErr=''; $bannedWords=[]; $bannedErr=''; $modCfg=cmt_default_config();
if (!empty($_SESSION['admin_logged'])) {
    $cmtGot=githubGetFile($config,'data/comments.json');
    if($cmtGot['error']) $cmtErr=$cmtGot['error'];
    else $cmtList=is_array($cmtGot['data'])?$cmtGot['data']:[];
    $bannedWords = cmt_load_banned();
    $modCfg = cmt_load_config();
}
// Luật thưởng EXP bình luận (gương với api/economy.js): đủ dài, không spam,
// không trùng, tối đa 2 lượt/ngày/uid. Không đạt thì vẫn duyệt hiển thị, chỉ không cộng tiền.
function cmt_norm_vn($s){
    $s=mb_strtolower(strval($s),'UTF-8');
    $s=preg_replace('/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ ]/u',' ',$s);
    return trim(preg_replace('/\s+/u',' ',$s));
}
function cmt_bigrams($s){
    $out=[]; $len=mb_strlen($s,'UTF-8');
    for($i=0;$i+1<$len;$i++){ $b=mb_substr($s,$i,2,'UTF-8'); if(mb_substr($b,0,1,'UTF-8')!==' '||mb_substr($b,1,1,'UTF-8')!==' ') $out[$b]=1; }
    return $out;
}
function cmt_bonus_ok($text,$uid,$cid,$list){
    if($uid===''||$cid==='')return false;
    $t=trim(strval($text));
    if(mb_strlen($t,'UTF-8')<12)return false;
    preg_match_all('/[A-Za-zÀ-ỹđ]/u',$t,$m);
    if(count($m[0])/max(1,mb_strlen($t,'UTF-8'))<0.4)return false;
    if(preg_match('/(.)\1{5,}/u',$t))return false;
    $mine=[]; $today=gmdate('Y-m-d',time()+7*3600);
    foreach($list as $c){ if(($c['status']??'')==='approved'&&($c['uid']??'')===$uid&&($c['id']??'')!==$cid)$mine[]=$c; }
    $mine=array_slice($mine,-60);
    $todayN=0; foreach($mine as $c){ if(substr(strval($c['created_at']??''),0,10)===$today)$todayN++; }
    if($todayN>=2)return false;
    $nb=cmt_bigrams(cmt_norm_vn($t));
    if($nb){ foreach(array_slice($mine,-30) as $c){
        $cb=cmt_bigrams(cmt_norm_vn($c['text']??''));
        if(!$cb)continue;
        if(count(array_intersect_key($nb,$cb))/min(count($nb),count($cb))>0.8)return false;
    }}
    return true;
}
if (isset($_POST['cmt_action'])) {
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ.'; $msgType='error'; }
    else{
        $cid=(string)($_POST['cmt_id']??'');
        $act=$_POST['cmt_action']==='approve'?'approved':'delete';
        $got=githubGetFile($config,'data/comments.json');
        if($got['error']){ $msg='❌ '.$got['error']; $msgType='error'; }
        else{
            $list=is_array($got['data'])?$got['data']:[];
            $apprUid=''; $apprText=''; $wasPending=false;
            foreach($list as $c){ if(($c['id']??'')===$cid){ $wasPending=(($c['status']??'')!=='approved'); if(!empty($c['uid']))$apprUid=(string)$c['uid']; $apprText=(string)($c['text']??''); } }
            if($act==='delete') $list=array_values(array_filter($list,fn($c)=>($c['id']??'')!==$cid));
            else foreach($list as &$c){ if(($c['id']??'')===$cid) $c['status']='approved'; } unset($c);
            $ok=githubPutFile($config,'data/comments.json',$list,'moderate comment '.$cid.' ('.$act.')',$syncMsg);
            // Thưởng +5 EXP cho chủ bình luận có tài khoản (mỗi bình luận 1 lần, phải đạt chuẩn chống farm)
            if($ok && $act==='approve' && $wasPending && $apprUid!=='' && cmt_bonus_ok($apprText,$apprUid,$cid,$list)){
                $eGot=githubGetFile($config,'data/economy.json');
                if(!$eGot['error']){
                    $emap=is_array($eGot['data'])?$eGot['data']:[];
                    $ek='u_'.$apprUid;
                    $er=is_array($emap[$ek]??null)?$emap[$ek]:[];
                    if(empty($er['bonus'][$cid])){
                        $er['bal']=max(0,(int)($er['bal']??0))+5;
                        if(!is_array($er['bonus']??null))$er['bonus']=[];
                        $er['bonus'][$cid]=1;
                        if(!isset($er['last']))$er['last']='';
                        if(!isset($er['streak']))$er['streak']=0;
                        if(!isset($er['owned'])||!is_array($er['owned']))$er['owned']=[];
                        $emap[$ek]=$er;
                        $eSync='';
                        if(githubPutFile($config,'data/economy.json',$emap,'economy: approve bonus +5 '.$cid,$eSync)) $msg.=' (+5 EXP)';
                    }
                }
            }
            $msg=($act==='delete'?'Đã xóa bình luận. ':'Đã duyệt bình luận. ').$syncMsg; $msgType=$ok?'success':'error';
            $cmtList=$list;
        }
    }
}
if (isset($_POST['cmt_auto_approve'])) {
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ.'; $msgType='error'; }
    else{
        $got=githubGetFile($config,'data/comments.json');
        if($got['error']){ $msg='❌ '.$got['error']; $msgType='error'; }
        else{
            $list=is_array($got['data'])?$got['data']:[];
            $cnt=0; $skip=0; $bonusUids=[];
            foreach($list as &$c){ if(($c['status']??'')==='pending'){
                $chk=cmt_check($c['text']??'', $c['name']??'');
                if($chk['ok']){ $c['status']='approved'; $cnt++; if(!empty($c['uid'])&&cmt_bonus_ok($c['text']??'',(string)$c['uid'],(string)($c['id']??''),$list))$bonusUids[(string)$c['uid']][]=(string)($c['id']??''); } else { $skip++; if(!isset($c['mod_reason'])) $c['mod_reason']=$chk['reason']; }
            }} unset($c);
            if($cnt>0){
                $ok=githubPutFile($config,'data/comments.json',$list,'auto-approve '.$cnt.' comments',$syncMsg);
                // Thưởng +5 EXP/bình luận cho chủ có tài khoản
                $bonusN=0;
                if($ok && $bonusUids){
                    $eGot=githubGetFile($config,'data/economy.json');
                    if(!$eGot['error']){
                        $emap=is_array($eGot['data'])?$eGot['data']:[];
                        foreach($bonusUids as $bu=>$cids){
                            $ek='u_'.$bu;
                            $er=is_array($emap[$ek]??null)?$emap[$ek]:[];
                            if(!is_array($er['bonus']??null))$er['bonus']=[];
                            foreach(array_unique($cids) as $bc){
                                if($bc===''||!empty($er['bonus'][$bc]))continue;
                                $er['bal']=max(0,(int)($er['bal']??0))+5;
                                $er['bonus'][$bc]=1; $bonusN++;
                            }
                            if(!isset($er['last']))$er['last']='';
                            if(!isset($er['streak']))$er['streak']=0;
                            if(!isset($er['owned'])||!is_array($er['owned']))$er['owned']=[];
                            $emap[$ek]=$er;
                        }
                        $eSync='';
                        if(!githubPutFile($config,'data/economy.json',$emap,'economy: approve bonus +5 x'.$bonusN,$eSync))$bonusN=0;
                    }
                }
                $msg="✅ Auto-duyệt $cnt bình luận sạch (bỏ qua $skip không đạt filter). ".($bonusN>0?"+$bonusN lượt thưởng EXP. ":'').$syncMsg; $msgType=$ok?'success':'error';
                $cmtList=$list;
            } else { $msg="Không có bình luận nào đạt filter để duyệt (bỏ qua $skip)."; $msgType='info'; }
        }
    }
}
if (isset($_POST['cmt_bulk_delete'])) {
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ.'; $msgType='error'; }
    else{
        $ids = $_POST['cmt_ids'] ?? [];
        if(!is_array($ids)) $ids=[$ids];
        $ids = array_filter(array_map('strval',$ids));
        if(!$ids){ $msg='Chưa chọn bình luận nào để xóa.'; $msgType='error'; }
        else{
            $got=githubGetFile($config,'data/comments.json');
            if($got['error']){ $msg='❌ '.$got['error']; $msgType='error'; }
            else{
                $list=is_array($got['data'])?$got['data']:[];
                $before=count($list);
                $list=array_values(array_filter($list, fn($c)=>!in_array(($c['id']??''), $ids, true)));
                $del=$before-count($list);
                $ok=githubPutFile($config,'data/comments.json',$list,'bulk delete '.$del.' comments',$syncMsg);
                $msg="Đã xóa $del bình luận. ".$syncMsg; $msgType=$ok?'success':'error';
                $cmtList=$list;
            }
        }
    }
}
if (isset($_POST['banned_add'])) {
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ.'; $msgType='error'; }
    else{
        $w = trim((string)($_POST['banned_word'] ?? ''));
        if($w==='') { $msg='Nhập từ cấm cần thêm.'; $msgType='error'; }
        elseif(mb_strlen($w) > 30){ $msg='Từ cấm tối đa 30 ký tự.'; $msgType='error'; }
        else{
            $list = cmt_load_banned();
            $low = mb_strtolower($w,'UTF-8');
            $exists = false; foreach($list as $e){ if(mb_strtolower($e,'UTF-8')===$low) $exists=true; }
            if($exists){ $msg='Từ này đã có trong danh sách.'; $msgType='info'; }
            else{
                $list[] = $w; sort($list, SORT_NATURAL|SORT_FLAG_CASE);
                $ok = githubPutFile($config,'data/banned_words.json',$list,'add banned word: '.$w,$syncMsg);
                if($ok){ @file_put_contents(__DIR__.'/data/banned_words.json', json_encode($list, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)); }
                $msg=$ok? "Đã thêm từ cấm: <b>".htmlspecialchars($w)."</b>. ".$syncMsg : "Lỗi thêm từ cấm: ".strip_tags($syncMsg); $msgType=$ok?'success':'error';
                $bannedWords=$list;
            }
        }
    }
}
if (isset($_POST['banned_delete'])) {
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ.'; $msgType='error'; }
    else{
        $w = (string)($_POST['banned_delete'] ?? '');
        $list = cmt_load_banned();
        $new = array_values(array_filter($list, fn($e)=>$e!==$w));
        if(count($new)===count($list)){ $msg='Không tìm thấy từ này.'; $msgType='error'; }
        else{
            $ok = githubPutFile($config,'data/banned_words.json',$new,'remove banned word: '.$w,$syncMsg);
            if($ok){ @file_put_contents(__DIR__.'/data/banned_words.json', json_encode($new, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)); }
            $msg=$ok? "Đã xóa từ cấm: <b>".htmlspecialchars($w)."</b>. ".$syncMsg : "Lỗi xóa: ".strip_tags($syncMsg); $msgType=$ok?'success':'error';
            $bannedWords=$new;
        }
    }
}
// Lưu cấu hình kiểm duyệt (auto + AI) — không cần động vào Vercel
if (isset($_POST['modcfg_save'])) {
    if(!check_csrf()){ $msg='Token bảo mật không hợp lệ.'; $msgType='error'; }
    else{
        $new = [
            'auto_approve' => isset($_POST['cfg_auto']),
            'ai_enabled' => isset($_POST['cfg_ai']),
            'threshold' => min(0.99, max(0.1, (float)($_POST['cfg_threshold'] ?? 0.75))),
        ];
        $ok = githubPutFile($config,'data/moderate_config.json',$new,'update moderate config',$syncMsg);
        if($ok){ @file_put_contents(__DIR__.'/data/moderate_config.json', json_encode($new, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)); }
        $msg=$ok? "Đã lưu cấu hình kiểm duyệt. ".$syncMsg : "Lỗi lưu cấu hình: ".strip_tags($syncMsg); $msgType=$ok?'success':'error';
        $modCfg=$new;
    }
}
?>
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin - JAVA.WAP.SH</title>
<style>
*{box-sizing:border-box}body{font-family:Be Vietnam Pro,system-ui;background:#eef2f7;margin:0;color:#1a2332;font-size:13px}
a{color:#2b5da8;text-decoration:none}
.top{background:#0f1e36;color:#7fb1ff;padding:8px 14px;display:flex;justify-content:space-between;font-family:monospace;font-size:11px}
.header{background:linear-gradient(135deg,#2b5da8,#3a7bd5);color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px}
.header h1{margin:0;font-size:18px}
.btn{background:#2b5da8;color:#fff;border:none;padding:7px 12px;border-radius:6px;font-weight:700;cursor:pointer;font-size:12px}
.btn.outline{background:#fff;color:#2b5da8;border:1px solid #2b5da8}
.btn.danger{background:#e5484d}
.btn.small{padding:5px 8px;font-size:11px}
.msg{margin:10px 14px;padding:10px;border-radius:6px}
.msg.success{background:#d6f5d6;border:1px solid #8ec88e;color:#0a5c0a}
.msg.error{background:#ffe0e0;border:1px solid #e8a0a0;color:#7a0000}
.msg.info{background:#fffbe6;border:1px solid #e6c87a;color:#7a5a00}
.wrap{max-width:1100px;margin:0 auto;padding:14px;display:grid;grid-template-columns:360px minmax(0,1fr);gap:14px;align-items:start}
.wrap>*{min-width:0}
@media(max-width:900px){.wrap{grid-template-columns:1fr}}
@media(max-width:640px){body{font-size:12px}.header h1{font-size:15px}.table{font-size:11px}.table th,.table td{padding:4px}.btn{padding:6px 10px}.card-body{padding:10px}}
.card{background:#fff;border:1px solid #a8b5c8;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.card-title{background:#2b5da8;color:#fff;font-weight:700;padding:8px 12px;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.card-body{padding:12px}
label{font-weight:600;font-size:11px;color:#34465f;display:block;margin:8px 0 3px}
input[type=text],input[type=number],select,textarea{width:100%;padding:7px 8px;border:1px solid #a8b5c8;border-radius:6px;font-size:12px;font-family:inherit}
textarea{resize:vertical}
.checks{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0}
.checks label{font-weight:400;display:flex;gap:4px;align-items:center;margin:0}
.res-links{display:grid;gap:6px;margin-top:6px}
.res-links div{display:flex;gap:6px;align-items:center}
.res-links div b{width:70px;font-size:11px}
.table{width:100%;border-collapse:collapse;font-size:12px}
.table th{background:#f0f4fb;padding:6px;text-align:left;border:1px solid #d6deea}
.table td{padding:6px;border:1px solid #d6deea;vertical-align:top}
.table img{width:36px;height:36px;border-radius:6px;object-fit:cover;border:1px solid #d6deea}
.badge{font-size:8px;padding:1px 4px;border-radius:4px;color:#fff}
.badge.hot{background:#ff3b30}.badge.vi{background:#0a9c4a}
.actions{display:flex;gap:4px;flex-wrap:wrap}
hr{border:none;border-top:1px dashed #d6deea;margin:12px 0}
.tabs{max-width:1100px;margin:0 auto;padding:10px 14px 0;display:flex;gap:6px;flex-wrap:wrap;border-bottom:2px solid #d6deea}
.tab{padding:8px 14px;border:1px solid #a8b5c8;border-bottom:none;border-radius:8px 8px 0 0;background:#eef2f7;font-weight:700;font-size:12px;cursor:pointer;color:#34465f}
.tab.active{background:#2b5da8;color:#fff;border-color:#2b5da8}
.tab-pane{display:none}
.tab-pane.active{display:grid}
@media(max-width:640px){.tabs{padding:8px 10px 0}.tab{padding:6px 10px;font-size:11px}}
.wm-box{background:#f8fbff;border:1px dashed #a8c0e0;border-radius:6px;padding:8px;margin-top:6px}
.wm-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.wm-row .wm-file{font-size:11px;flex:1;min-width:140px}
.wm-preview{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.wm-preview .wm-thumb{position:relative;width:64px;height:64px;border-radius:6px;overflow:hidden;border:1px solid #d6deea;background:#eef2f7}
.wm-preview .wm-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.wm-preview .wm-thumb .wm-tag{position:absolute;left:0;right:0;bottom:0;font-size:8px;text-align:center;padding:1px 0;color:#fff}
.wm-preview .wm-thumb .wm-tag.ok{background:rgba(10,156,74,.85)}
.wm-preview .wm-thumb .wm-tag.err{background:rgba(200,0,0,.85)}
.wm-preview .wm-thumb .wm-tag.busy{background:rgba(43,93,168,.85)}
.wm-status{font-size:11px;color:#5a6b87;margin-top:4px}
.wm-pos-mini{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;font-size:10px}
.wm-pos-mini label{font-weight:400;display:flex;gap:3px;align-items:center;margin:0;background:#fff;border:1px solid #d6deea;border-radius:10px;padding:2px 8px;cursor:pointer}
.wm-pos-mini input{margin:0}
</style>
</head>
<body>
<div class="top"><span>◉ ADMIN PANEL - LOCAL XAMPP</span><span><?=count($games)?> game</span></div>
<div class="header">
  <h1>☺ JAVA.WAP.SH - Quản lý Game</h1>
  <div style="display:flex;gap:8px;align-items:center">
    <form method="post" style="margin:0"><?=csrf_field()?><button name="sync" class="btn" style="background:#ffe27a;color:#1e3f73">⬆ Đồng bộ GitHub</button></form>
    <a href="?export=json" class="btn outline">⬇ Xuất JSON</a>
    <a href="index.html" target="_blank" class="btn outline">Xem FE</a>
    <a href="?logout=1" class="btn danger">Đăng xuất</a>
  </div>
</div>
<?php if($msg) echo "<div class='msg $msgType'>$msg</div>"; ?>

<div class="tabs" role="tablist">
  <button type="button" class="tab active" data-tab="tab-game" onclick="switchTab('tab-game')">Game (<?=count($games)?>)</button>
  <button type="button" class="tab" data-tab="tab-cmt" onclick="switchTab('tab-cmt')">Binh luan (<?=count($cmtList)?>)</button>
  <button type="button" class="tab" data-tab="tab-banned" onclick="switchTab('tab-banned')">Tu cam (<?=count($bannedWords)?>)</button>
  <button type="button" class="tab" data-tab="tab-system" onclick="switchTab('tab-system')">He thong</button>
</div>

<div class="wrap tab-pane active" id="tab-game">
  <!-- FORM -->
  <div class="card" style="height:fit-content">
    <div class="card-title"><?= $editGame ? '✎ Sửa game: '.htmlspecialchars($editGame['id']) : '＋ Thêm game mới' ?></div>
    <div class="card-body">
    <form method="post" id="gameForm" enctype="multipart/form-data">
      <?=csrf_field()?>
      <label>Slug URL (không dấu, vd: asphalt-6-viet-hoa) → URL: <code>/game/slug.html</code></label>
      <input type="text" name="id" value="<?=htmlspecialchars($editGame['id'] ?? '')?>" placeholder="để trống = tự tạo từ tên game" <?= $editGame ? 'readonly style="background:#f0f4fb"' : ''?>>
      <label>Tên game *</label>
      <input type="text" name="name" required value="<?=htmlspecialchars($editGame['name'] ?? '')?>" placeholder="Asphalt 6: Adrenaline...">
      <div><label>Thể loại</label><select name="cat"><option value="">-- chọn --</option>
        <?php $cats=['Hành động','Nhập vai','Đua xe','Bắn súng','Trí tuệ','Thể thao','Phiêu lưu','Nông trại']; foreach($cats as $c){ $sel=($editGame['cat']??'')===$c?'selected':''; echo "<option $sel>$c</option>"; } ?>
      </select></div>
      <label>Dung lượng</label><input type="text" name="size" value="<?=htmlspecialchars($editGame['size'] ?? '')?>" placeholder="1.2 MB">
      <label>📱 Màn hình hỗ trợ + 🔗 Link tải JAR</label>
      <div style="background:#f8fbff;border:1px solid #d6deea;border-radius:6px;padding:8px">
        <div style="font-size:11px;color:#5a6b87;margin-bottom:6px">Tick chọn độ phân giải bạn hỗ trợ, rồi nhập link tải .JAR tương ứng. Link có thể là <code>https://.../game.jar</code> hoặc file trong <code>/files/240x320/game.jar</code></div>
        <table style="width:100%;border-collapse:collapse">
          <tr style="background:#eef2f7;font-size:11px"><th style="padding:6px;text-align:left">✔</th><th style="padding:6px;text-align:left">Độ phân giải</th><th style="padding:6px">Link JAR</th></tr>
          <?php $allRes=['128x160','128x128','176x220','176x208','240x320','320x240','360x640']; $curRes=$editGame['res']??['240x320']; $curJar=$editGame['jar']??[]; foreach($allRes as $r){ $ck=in_array($r,$curRes)?'checked':''; $jarVal=htmlspecialchars($curJar[$r]??''); echo "<tr style='border-top:1px solid #e6ebf2'><td style='padding:4px;text-align:center'><input type='checkbox' name='res[]' value='$r' $ck onchange='this.closest(\"tr\").querySelector(\"input[type=text]\").disabled=!this.checked'></td><td style='padding:4px;font-weight:600;font-size:12px'>$r</td><td style='padding:4px'><input type='text' name='jar_$r' value='$jarVal' placeholder='https://.../$r.jar' style='font-size:11px;width:100%' ".($ck?'':'disabled')."></td></tr>"; } ?>
        </table>
      </div>
      <label>Mô tả</label><textarea name="desc" rows="3" placeholder="Giới thiệu game..."><?=htmlspecialchars($editGame['desc'] ?? '')?></textarea>
      <div style="margin-top:4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button type="button" class="btn small outline" onclick="insertCredit()">＋ Chèn credit chủ quyền</button>
        <small style="color:#5a6b87">[credit]…[/credit] hiển thị nổi bật ngoài web + theo bài khi bị copy. Xem trước bằng nút “Xem trước”.</small>
      </div>
      <script>function insertCredit(){var ta=document.querySelector('textarea[name=desc]');if(!ta)return;if(ta.value.indexOf('[credit]')>=0){alert('Mô tả đã có [credit] rồi.');try{ta.focus();}catch(e){}return;}var tpl='© NGUỒN: J2ME.VERCEL.APP\n[credit]Game java hay - vào ngay https://j2me.vercel.app\nVui lòng ghi thêm 2 dòng này khi chia sẻ lại bài viết.[/credit]\n';try{var s=ta.selectionStart||ta.value.length,e=ta.selectionEnd||ta.value.length;ta.value=ta.value.slice(0,s)+tpl+ta.value.slice(e);}catch(err){ta.value+=tpl;}try{ta.focus();}catch(e){}}</script>
      <label>Thumb (URL ảnh)</label><input type="text" id="thumbUrl" name="thumb" value="<?=htmlspecialchars($editGame['thumb'] ?? '')?>" placeholder="https://... (hoặc dùng nút Watermark & Upload bên dưới)">
      <?php if(!empty($editGame['thumb'])) echo '<div style="margin-top:6px"><img src="'.htmlspecialchars($editGame['thumb']).'" style="width:64px;height:64px;border-radius:8px;border:1px solid #d6deea;object-fit:cover" onerror="this.style.display=\'none\'"><br><small style="color:#5a6b87">Ảnh hiện tại</small></div>'; ?>
      <div class="wm-box" data-target="thumbUrl" data-multi="0">
        <div class="wm-row">
          <input type="file" class="wm-file" accept=".jpg,.jpeg,.png,.gif,.webp">
          <button type="button" class="btn small wm-go">🖼 Đóng dấu & Upload</button>
        </div>
        <div class="wm-pos-mini">
          <label><input type="radio" name="wmposA" value="top" checked> ⬆ Trên</label>
          <label><input type="radio" name="wmposA" value="bottom"> ⬇ Dưới</label>
        </div>
        <div class="wm-preview"></div>
        <div class="wm-status"></div>
      </div>

      <label>Screenshot (mỗi dòng 1 URL, hoặc cách nhau bằng dấu phẩy)</label><textarea name="shots" id="shotsUrls" rows="2" placeholder="https://.../240x320, https://..."><?=htmlspecialchars(implode("\n",$editGame['shots']??[]))?></textarea>
      <div class="wm-box" data-target="shotsUrls" data-multi="1">
        <div class="wm-row">
          <input type="file" class="wm-file" accept=".jpg,.jpeg,.png,.gif,.webp" multiple>
          <button type="button" class="btn small wm-go">🖼 Đóng dấu & Upload (nhiều ảnh)</button>
        </div>
        <div class="wm-pos-mini">
          <label><input type="radio" name="wmposB" value="top" checked> ⬆ Trên</label>
          <label><input type="radio" name="wmposB" value="bottom"> ⬇ Dưới</label>
        </div>
        <div class="wm-preview"></div>
        <div class="wm-status"></div>
      </div>
      <div style="font-size:11px;color:#5a6b87">Ảnh sẽ được đóng watermark logo ngay trên trình duyệt rồi tự upload lên ImgBB, link tự điền vào ô URL ở trên. Cấu hình logo/API key ở khối "⚙️ Cấu hình Watermark" phía dưới form.</div>
      <div class="checks" style="margin-top:8px">
        <label><input type="checkbox" name="hot" <?=!empty($editGame['hot'])?'checked':''?>> 🔥 HOT</label>
        <label><input type="checkbox" name="vi" <?=!empty($editGame['vi'])?'checked':''?>> 🇻🇳 Việt Hóa</label>
        <label><input type="checkbox" name="new" <?=!empty($editGame['new'])?'checked':''?>> NEW</label>
      </div>
      <label>🔒 Khóa tải (người xem đủ điều kiện mới bấm Tải được)</label>
      <div style="background:#fffbe6;border:1px solid #e6c87a;border-radius:6px;padding:8px;display:grid;gap:6px">
        <?php $eg=$editGame['gate']??['type'=>'none']; if(!is_array($eg))$eg=['type'=>'none']; $egT=$eg['type']??'none'; ?>
        <select name="gate_type" onchange="gateTypeChanged(this.value)">
          <?php foreach(['none'=>'Mở tự do','xp'=>'Đủ tổng XP','stats'=>'Khóa theo chỉ số (tích nhiều điều kiện)','login'=>'Bắt đăng nhập (khóa cứng)'] as $k=>$lb){ $s=($egT===$k?'selected':''); echo "<option value='$k' $s>$lb</option>"; } ?>
        </select>
        <div id="gateOpts" style="display:<?=($egT==='none'?'none':'grid')?>;gap:6px;grid-template-columns:1fr 1fr">
          <div><small>Tổng XP</small><input type="number" name="gate_xp" min="1" value="<?=htmlspecialchars($eg['xp']??100)?>"></div>
        </div>
        <?php $egR=is_array($eg['require']??null)?$eg['require']:[]; ?>
        <div id="gateStats" style="display:<?=($egT==='stats'?'grid':'none')?>;gap:6px">
          <div style="display:flex;gap:6px;align-items:center"><label style="flex:1;font-size:11px"><input type="checkbox" name="rq_read_on" <?=isset($egR['read'])?'checked':''?>> ⏱️ Đọc bài (giây)</label><input type="number" name="rq_read" min="1" max="3600" value="<?=htmlspecialchars($egR['read']??($editGame['read_secs']??10))?>" style="width:90px"></div>
          <div style="display:flex;gap:6px;align-items:center"><label style="flex:1;font-size:11px"><input type="checkbox" name="rq_likes_on" <?=isset($egR['likes'])?'checked':''?>> 👍 Lượt thích game</label><input type="number" name="rq_likes" min="1" max="10000" value="<?=htmlspecialchars($egR['likes']??5)?>" style="width:90px"></div>
          <div style="display:flex;gap:6px;align-items:center"><label style="flex:1;font-size:11px"><input type="checkbox" name="rq_completed_on" <?=isset($egR['completed'])?'checked':''?>> 🏆 Game phá đảo</label><input type="number" name="rq_completed" min="1" max="10000" value="<?=htmlspecialchars($egR['completed']??3)?>" style="width:90px"></div>
          <small style="color:#5a6b87">Tích nhiều điều kiện = phải đủ TẤT CẢ. Mặc định 10s đọc + 1 like thay cho bình luận.</small>
        </div>
        <div id="gateLoginRow" style="display:<?=($egT==='none'?'none':'block')?>"><label style="font-size:11px"><input type="checkbox" name="gate_login" <?=!empty($eg['login'])?'checked':''?>> 🔐 Bắt buộc đăng nhập (áp dụng mọi loại khóa — khách không tải được)</label></div>
          <div style="margin-top:6px;background:#f0f8ff;border:1px dashed #a8c0e0;border-radius:6px;padding:6px;display:grid;gap:4px"><b style="font-size:11px;color:#0066cc">✨ Hiệu ứng sương mù</b>
            <?php $vol=$editGame['voluntary']??['fog'=>1]; ?>
            <label style="font-size:11px"><input type="checkbox" name="vol_fog" <?=!empty($vol['fog'])?'checked':''?>> 🌫️ Sương mù tan theo vùng + % + mẹo (dùng read_secs)</label>
            <small style="color:#5a6b87">Tick để hiện sương mờ tan dần theo 30s, dùng chung `read_secs` và `i18n`</small>
          </div>
          <div><small>💰 Giá tải (EXP)</small><input type="number" name="dl_cost" min="0" max="100000" value="<?=htmlspecialchars($editGame['dl_cost']??10)?>" style="width:100px"> <small style="color:#5a6b87">tải lại game đã sở hữu thì miễn phí • gợi ý: kho cũ ~5, game mới ~15</small></div>
          <div style="margin-top:6px"><small>⏱️ Thời gian đọc bài (giây)</small><input type="number" name="read_secs" min="1" max="3600" value="<?=htmlspecialchars($editGame['read_secs']??10)?>" style="width:100px"> <small style="color:#5a6b87">mở trang đủ từng này giây mới mở tải • mặc định 10</small></div>
        <script>function gateTypeChanged(v){try{document.getElementById('gateOpts').style.display=v==='none'?'none':'grid';document.getElementById('gateStats').style.display=v==='stats'?'grid':'none';document.getElementById('gateLoginRow').style.display=v==='none'?'none':'block';}catch(e){}}</script>
        <small style="color:#5a6b87">Khóa mềm: chặn nút tải + link copy tay (proof theo ngày). Ngoài web hiện ổ khóa + đường dẫn sang Hồ sơ.</small>
        <br><small>🔑 Mã hóa link: <?=lock_secret()!==null?'<b style="color:#0a9c4a">đã bật (AES-GCM)</b>':'<b style="color:#c43c64">CHƯA — link lưu plaintext, dễ soi source</b>'?> — đặt LOCK_SECRET (≥16 ký tự) trong env hoặc config.php, và thêm cùng giá trị vào Vercel env.</small>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button type="submit" name="save" class="btn" style="flex:1">💾 Lưu & Đồng bộ</button>
        <button type="button" class="btn outline" onclick="doPreview()">👁 Xem trước</button>
        <?php if($editGame) echo '<a href="admin.php" class="btn outline" style="text-align:center;padding:7px 12px">Hủy</a>'; ?>
      </div>
    </form>
    </div>
  </div>

  <!-- LIST -->
  <div class="card">
    <div class="card-title">📋 Danh sách game (<?=count($games)?>) - data/games.json</div>
    <div class="card-body" style="border-bottom:1px solid #d6deea">
      <?php $nHot=count(array_filter($games,fn($x)=>!empty($x['hot']))); $nVi=count(array_filter($games,fn($x)=>!empty($x['vi']))); ?>
      <div style="font-size:12px;margin-bottom:8px">Tổng: <b><?=count($games)?></b> • 🔥 HOT: <b><?=$nHot?></b> • 🇻🇳 Việt hóa: <b><?=$nVi?></b></div>
      <input type="text" id="admSearch" placeholder="🔍 Tìm theo tên game..." oninput="admFilter()" style="margin:0">
    </div>
    <div style="overflow:auto">
    <table class="table" id="gameTable">
      <tr><th>#</th><th>Game</th><th>Màn hình</th><th>Ngày đăng</th><th>Hành động</th></tr>
      <?php foreach($games as $i=>$g): ?>
      <tr data-name="<?=htmlspecialchars(mb_strtolower(($g['name']??'').' '.($g['id']??''),'UTF-8'))?>">
        <td><?= $i+1 ?></td>
        <td>
          <div style="display:flex;gap:8px;align-items:center">
            <img src="<?=htmlspecialchars($g['thumb'])?>" onerror="this.src='https://picsum.photos/seed/fallback/36/36'">
            <div>
              <b><?=htmlspecialchars($g['name'])?></b><br>
              <small style="color:#5a6b87"><?=htmlspecialchars($g['cat'])?> • <?=htmlspecialchars($g['size'])?></small>
              <?php if(!empty($g['hot'])) echo ' <span class="badge hot">HOT</span>'; if(!empty($g['vi'])) echo ' <span class="badge vi">VI</span>'; if(!empty($g['gate']['type'])&&$g['gate']['type']!=='none') echo ' <span class="badge" style="background:#7a5a00">🔒</span>'; ?>
            </div>
          </div>
        </td>
        <td><small><?=htmlspecialchars(implode(', ',$g['res']??[]))?></small></td>
        <td><small><?=!empty($g['created_at'])?date('d/m/Y',strtotime($g['created_at'])):'—'?><?=!empty($g['updated_at'])&&($g['updated_at']??'')!==($g['created_at']??'')?'<br><span style="color:#5a6b87">sửa '.date('d/m/Y',strtotime($g['updated_at'])).'</span>':''?></small></td>
        <td>
          <div class="actions">
            <a href="game/<?=urlencode($g['id'])?>.html" target="_blank" class="btn small outline">Xem</a>
            <a href="?edit=<?=urlencode($g['id'])?>" class="btn small">Sửa</a>
            <form method="post" style="display:inline;margin:0" onsubmit="return confirm('Xóa <?=htmlspecialchars($g['name'],ENT_QUOTES)?>?')"><?=csrf_field()?><input type="hidden" name="delete" value="<?=htmlspecialchars($g['id'])?>"><button type="submit" class="btn small danger">Xóa</button></form>
          </div>
        </td>
      </tr>
      <?php endforeach; ?>
    </table>
    </div>
    <div style="padding:10px;font-size:11px;color:#5a6b87;text-align:center">
      File local: <code><?=htmlspecialchars($dataFile)?></code> • Token: <?=empty($config['GITHUB_TOKEN'])?'<b style="color:#c00">chưa cấu hình</b>':'<b style="color:#0a0">đã cấu hình</b>'?> • Repo: <?=htmlspecialchars($config['GITHUB_REPO']?:'chưa điền')?>
    </div>
  </div>
</div>

<div class="wrap tab-pane" id="tab-cmt">
  <div class="card" style="grid-column:1/-1">
    <div class="card-title">Binh luan — Auto filter</div>
    <div class="card-body">
      <?php if($cmtErr): ?>
        <small style="color:#a00"><?=$cmtErr?></small>
      <?php else:
        $pend=array_values(array_filter($cmtList,fn($c)=>($c['status']??'')==='pending'));
        $appr=array_values(array_filter($cmtList,fn($c)=>($c['status']??'')==='approved'));
        $previewOk=0; foreach($pend as $cc){ if(cmt_check($cc['text']??'',$cc['name']??'')['ok']) $previewOk++; }
        usort($cmtList, fn($a,$b)=>strcmp($b['created_at']??'', $a['created_at']??''));
      ?>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
          <span>Tong: <b><?=count($cmtList)?></b> • Cho duyet: <b><?=count($pend)?></b> • Da duyet: <b><?=count($appr)?></b></span>
          <form method="post" style="margin:0"><?=csrf_field()?><button name="cmt_auto_approve" class="btn small" type="submit" style="background:#0a9c4a">Auto-duyet <?=$previewOk?> sach</button></form>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <input type="text" id="cmtSearch" placeholder="Tim binh luan..." oninput="cmtFilter()" style="flex:1;min-width:200px">
          <select id="cmtStatus" onchange="cmtFilter()" style="width:150px"><option value="">Tat ca</option><option value="pending">Cho duyet</option><option value="approved">Da duyet</option></select>
          <select id="cmtGame" onchange="cmtFilter()" style="width:180px"><option value="">Tat ca game</option><?php foreach($games as $gg) echo '<option value="'.htmlspecialchars($gg['id']).'">'.htmlspecialchars($gg['name']).'</option>'; ?></select>
        </div>
        <form method="post" id="cmtBulkForm" onsubmit="return confirm('Xoa?')">
          <?=csrf_field()?>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <label><input type="checkbox" id="cmtCheckAll" onchange="document.querySelectorAll('.cmt-check').forEach(c=>c.checked=this.checked)"> Chon tat ca</label>
            <button name="cmt_bulk_delete" class="btn small danger" type="submit">Xoa da chon</button>
          </div>
          <div id="cmtListWrap" style="max-height:520px;overflow:auto;border:1px solid #d6deea;border-radius:6px">
          <?php foreach($cmtList as $c):
            $gname=$c['game']??''; $glabel=$gname; foreach($games as $gg) if($gg['id']===$gname){$glabel=$gg['name'];break;}
            $chk=cmt_check($c['text']??'',$c['name']??''); $st=$c['status']??'pending';
          ?>
          <div class="cmt-row" data-status="<?=$st?>" data-game="<?=htmlspecialchars($c['game']??'')?>" data-search="<?=htmlspecialchars(mb_strtolower(($c['name']??'').' '.($c['text']??'').' '.$glabel,'UTF-8'))?>" style="border-bottom:1px solid #eef2f7;padding:8px;display:flex;gap:8px">
            <input type="checkbox" class="cmt-check" name="cmt_ids[]" value="<?=htmlspecialchars($c['id']??'')?>">
            <div style="flex:1">
              <b><?=htmlspecialchars($c['name']??'')?></b> <span style="color:#f59e0b"><?=str_repeat('★',(int)($c['stars']??0))?></span> <small>→ <?=htmlspecialchars($glabel)?></small>
              <div><?=htmlspecialchars($c['text']??'')?></div>
              <form method="post" style="display:inline"><?=csrf_field()?><input type="hidden" name="cmt_id" value="<?=htmlspecialchars($c['id']??'')?>"><button name="cmt_action" value="<?= $st==='pending'?'approve':'delete'?>" class="btn small <?= $st==='pending'?'':'danger'?>" type="submit"><?= $st==='pending'?'Duyet':'Xoa'?></button></form>
            </div>
          </div>
          <?php endforeach; ?>
          </div>
        </form>
        <script>function cmtFilter(){const q=(document.getElementById('cmtSearch').value||'').toLowerCase().trim();const st=document.getElementById('cmtStatus').value;const gm=document.getElementById('cmtGame').value;document.querySelectorAll('.cmt-row').forEach(r=>{const okQ=!q||(r.dataset.search||'').includes(q);const okS=!st||r.dataset.status===st;const okG=!gm||r.dataset.game===gm;r.style.display=(okQ&&okS&&okG)?'':'none';});}</script>
      <?php endif; ?>
    </div>
  </div>
</div>

<div class="wrap tab-pane" id="tab-banned">
  <div class="card" style="grid-column:1/-1">
    <div class="card-title">⚙️ Cấu hình kiểm duyệt (không cần vào Vercel)</div>
    <div class="card-body">
      <form method="post" style="display:grid;gap:8px;max-width:520px"><?=csrf_field()?>
        <label style="font-size:12px;display:flex;gap:8px;align-items:center;margin:0">
          <input type="checkbox" name="cfg_auto" <?=!empty($modCfg['auto_approve'])?'checked':''?>> <b>Auto-duyệt bình luận sạch</b>
        </label>
        <small style="color:#5a6b87">Bật: bình luận qua hết filter (không URL, không từ cấm, không spam) được duyệt ngay. Tắt: mọi bình luận mới đều chờ duyệt tay.</small>
        <label style="font-size:12px;display:flex;gap:8px;align-items:center;margin:0">
          <input type="checkbox" name="cfg_ai" <?=!empty($modCfg['ai_enabled'])?'checked':''?>> <b>Bật AI OpenAI Moderation (chống chửi lái + xúc phạm không từ cấm)</b>
        </label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <small style="color:#5a6b87">Ngưỡng chặn:</small>
          <input type="number" name="cfg_threshold" min="0.1" max="0.99" step="0.05" value="<?=htmlspecialchars($modCfg['threshold']??0.75)?>" style="width:90px">
          <small style="color:#5a6b87">(0.75 mặc định — càng thấp càng gắt)</small>
        </div>
        <small style="color:#5a6b87">🔑 Key OpenAI (OPENAI_API_KEY, lấy ở platform.openai.com → API keys) nhập 1 lần duy nhất trong Vercel → Settings → Environment Variables (không lưu key vào repo vì ai cũng đọc được). Chỉ comment <b>qua hết filter local</b> mới tốn 1 call AI. Bật công tắc mà chưa có key thì API tự bỏ qua AI, chỉ dùng filter local.</small>
        <div><button name="modcfg_save" class="btn small" type="submit">💾 Lưu cấu hình</button>
        <small style="color:#5a6b87">Hiện tại: auto <b><?=!empty($modCfg['auto_approve'])?'BẬT':'TẮT'?></b> • AI <b><?=!empty($modCfg['ai_enabled'])?'BẬT':'TẮT'?></b> (ngưỡng <?=htmlspecialchars($modCfg['threshold']??0.75)?>)</small></div>
      </form>
    </div>
  </div>
  <div class="card" style="grid-column:1/-1">
    <div class="card-title">Tu cam (<?=count($bannedWords)?>)</div>
    <div class="card-body">
      <small style="color:#5a6b87;display:block;margin-bottom:8px">Nguồn list gốc: <a href="https://github.com/blue-eyes-vn/vietnamese-offensive-words" target="_blank">blue-eyes-vn/vietnamese-offensive-words</a> (MIT) + từ bổ sung thủ công. Chạy offline 100%, không cần API.</small>
      <form method="post" style="display:flex;gap:8px"><?=csrf_field()?><input type="text" name="banned_word" placeholder="Nhap tu cam moi" style="flex:1" required><button name="banned_add" class="btn small" type="submit">Them</button></form>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        <?php foreach($bannedWords as $w): ?>
          <form method="post" style="margin:0"><?=csrf_field()?><input type="hidden" name="banned_delete" value="<?=htmlspecialchars($w)?>"><span style="background:#fff0f0;border:1px solid #e8a0a0;border-radius:16px;padding:3px 8px"><?=htmlspecialchars($w)?> <button type="submit" style="background:#e5484d;color:#fff;border:none;border-radius:50%;width:18px;height:18px">×</button></span></form>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
</div>

<div class="wrap tab-pane" id="tab-system">
  <div class="card" style="grid-column:1/-1">
    <div class="card-title">💾 Sao lưu & Khôi phục (tự backup mỗi lần lưu, giữ 10 bản)</div>
    <div class="card-body" style="display:grid;gap:10px">
      <div>
        <?php $baks=list_backups($bakDir); if(!$baks) echo '<small style="color:#5a6b87">Chưa có bản backup nào.</small>'; else foreach($baks as $b): $bn=basename($b); ?>
        <form method="post" style="display:flex;gap:8px;align-items:center;margin:4px 0;flex-wrap:wrap" onsubmit="return confirm('Khôi phục từ <?=$bn?>? Dữ liệu hiện tại sẽ được backup trước.')"><?=csrf_field()?>
          <code style="font-size:11px"><?=$bn?> (<?=round(filesize($b)/1024,1)?> KB)</code>
          <input type="hidden" name="restore" value="<?=$bn?>">
          <button class="btn small outline" type="submit">Khôi phục</button>
        </form>
        <?php endforeach; ?>
      </div>
      <hr>
      <form method="post" enctype="multipart/form-data" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><?=csrf_field()?>
        <b style="font-size:12px">Import JSON:</b>
        <input type="file" name="import_file" accept=".json,application/json" required style="font-size:12px">
        <button name="import" class="btn small" type="submit" onclick="return confirm('Import sẽ THAY TOÀN BỘ danh sách (đã backup trước). Tiếp tục?')">⬆ Import</button>
        <a href="?export=json" class="btn small outline">⬇ Xuất JSON hiện tại</a>
      </form>
    </div>
  </div>

  <!-- THÔNG BÁO GHIM -->
  <div class="card" style="grid-column:1/-1">
    <div class="card-title">📢 Thông báo ghim trang chủ (để trống = ẩn)</div>
    <div class="card-body">
      <form method="post"><?=csrf_field()?>
        <textarea name="notice_text" rows="2" placeholder="VD: Bảo trì 22h tối nay, link Drive chương 3 đã fix..."><?=htmlspecialchars($noticeCur['text']??'')?></textarea>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap">
          <button name="notice_save" class="btn small" type="submit">Lưu thông báo</button>
          <?php if(!empty($noticeCur['updated_at'])) echo '<small style="color:#5a6a7a">Cập nhật: '.htmlspecialchars($noticeCur['updated_at']).'</small>'; ?>
        </div>
      </form>
    </div>
  </div>

  <!-- CỘNG EXP THEO EMAIL -->
  <div class="card" style="grid-column:1/-1">
    <div class="card-title">💰 Nhập số EXP cho tài khoản (email)</div>
    <div class="card-body">
      <form method="post" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><?=csrf_field()?>
        <input type="email" name="exp_email" placeholder="ban@email.com" required value="<?=htmlspecialchars($expLookup['email'] ?? '')?>" style="flex:2;min-width:200px">
        <input type="number" name="exp_amount" placeholder="+/- EXP" value="10" style="flex:0 0 110px">
        <select name="exp_mode" style="flex:0 0 130px"><option value="add">Cộng/trừ</option><option value="set">Đặt bằng</option></select>
        <button name="exp_lookup" class="btn small outline" type="submit">Xem số dư</button>
        <button name="exp_adjust" class="btn small" type="submit" onclick="return confirm('Chốt số EXP này?')">Lưu EXP</button>
      </form>
      <?php if ($expLookup): ?>
        <div style="margin-top:8px;font-size:12px">📧 <b><?=htmlspecialchars($expLookup['email'])?></b> <small style="color:#5a6b87">(<?=htmlspecialchars($expLookup['uid'])?>)</small> — số dư ví: <b><?=htmlspecialchars($expLookup['bal'])?> EXP</b></div>
      <?php endif; ?>
      <small style="color:#5a6b87">Cần <code>SUPABASE_URL</code> + <code>SUPABASE_SERVICE_KEY</code> trong config.php để tra uid theo email. Ghi vào <code>data/economy.json</code> (khóa <code>u_&lt;uid&gt;</code>), tối đa 100000.</small>
    </div>
  </div>

  <!-- CẤU HÌNH WATERMARK -->
  <div class="card" style="grid-column:1/-1">
    <div class="card-title">⚙️ Cấu hình Watermark (lưu trong trình duyệt này, không gửi lên server)</div>
    <div class="card-body" style="display:grid;gap:10px">
      <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
        <div>
          <label>ImgBB API Key <small style="color:#5a6b87">(free, lấy tại <a href="https://api.imgbb.com/" target="_blank">api.imgbb.com</a>)</small></label>
          <input type="text" id="wmApiKey" placeholder="Dán API key ImgBB vào đây">
        </div>
        <div>
          <label>Vị trí watermark mặc định</label>
          <select id="wmPos">
            <option value="top">Trên</option>
            <option value="bottom">Dưới</option>
            <option value="center">Giữa ảnh (mờ)</option>
          </select>
        </div>
      </div>
      <div>
        <label>Logo watermark</label>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <input type="file" id="wmLogoFile" accept=".png,.jpg,.jpeg,.webp">
          <span style="font-size:11px;color:#5a6b87">hoặc dán URL:</span>
          <input type="text" id="wmLogoUrl" placeholder="https://.../logo.png" style="flex:1;min-width:200px">
          <img id="wmLogoPreview" style="height:36px;display:none;border:1px solid #d6deea;border-radius:6px;background:#f8fbff;padding:2px">
        </div>
      </div>
      <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
        <div>
          <label>Kích thước logo (% chiều rộng ảnh)</label>
          <input type="range" id="wmSize" min="10" max="70" value="45">
          <small id="wmSizeVal" style="color:#5a6b87">45%</small>
        </div>
        <div>
          <label>Độ mờ logo</label>
          <input type="range" id="wmOpacity" min="10" max="100" value="80">
          <small id="wmOpacityVal" style="color:#5a6b87">80%</small>
        </div>
      </div>
      <small style="color:#5a6b87">Cấu hình được lưu tự động vào trình duyệt (localStorage) cho lần sau. Vị trí có thể chọn lại riêng cho từng lần đóng dấu bên dưới nút "Đóng dấu & Upload".</small>
    </div>
  </div>

  <!-- ĐỔI MẬT KHẨU -->
  <div class="card" style="grid-column:1/-1">
    <div class="card-title">🔑 Đổi mật khẩu admin</div>
    <div class="card-body">
      <form method="post" style="display:grid;gap:8px;max-width:360px"><?=csrf_field()?>
        <input type="password" name="old_pass" placeholder="Mật khẩu hiện tại" required autocomplete="current-password">
        <input type="password" name="new_pass1" placeholder="Mật khẩu mới (≥6 ký tự)" required autocomplete="new-password">
        <input type="password" name="new_pass2" placeholder="Nhập lại mật khẩu mới" required autocomplete="new-password">
        <div><button name="change_pass" class="btn small" type="submit" onclick="return confirm('Đổi mật khẩu ngay?')">Đổi mật khẩu</button></div>
        <small style="color:#5a6b87">Mật khẩu lưu dạng hash + tự backup config cũ. Đổi xong phải đăng nhập lại.</small>
      </form>
    </div>
  </div>
</div>

<div style="text-align:center;padding:12px;font-size:11px;color:#5a6b87">
  Mẹo: Điền link JAR/JAD là link trực tiếp (https://.../game.jar) hoặc để "#" nếu chưa có. Ảnh thumb/screenshot có thể dùng picsum.photos để test.
</div>
<script>
function switchTab(id){
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  const pane=document.getElementById(id); if(pane) pane.classList.add('active');
  const tab=document.querySelector('.tab[data-tab="'+id+'"]'); if(tab) tab.classList.add('active');
  try{localStorage.setItem('admin_tab', id);}catch(e){}
}
(function(){try{const sv=localStorage.getItem('admin_tab'); if(sv&&document.getElementById(sv)) switchTab(sv);}catch(e){}})();
function admFilter(){
  const q=(document.getElementById('admSearch').value||'').toLowerCase().trim();
  document.querySelectorAll('#gameTable tr[data-name]').forEach(tr=>{
    tr.style.display=(!q||(tr.dataset.name||'').includes(q))?'':'none';
  });
}
function doPreview(){
  const f=document.getElementById('gameForm'); if(!f){alert('Không tìm thấy form!');return;}
  const fd=new FormData(f);
  const res=fd.getAll('res[]');
  const jar={}; res.forEach(r=>{const inp=f.querySelector('[name="jar_'+r+'"]'); jar[r]=inp?inp.value:'#';});
  const shots=String(fd.get('shots')||'').split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
  const ck=n=>{const el=f.querySelector('[name="'+n+'"]'); return !!(el&&el.checked);};
const g={
      id:String(fd.get('id')||'preview'), name:String(fd.get('name')||'(Chưa đặt tên)'),
      cat:String(fd.get('cat')||''), size:String(fd.get('size')||''), res:res,
      hot:ck('hot'), vi:ck('vi'), new:ck('new'),
      desc:String(fd.get('desc')||''), thumb:String(fd.get('thumb')||''),
       dl_cost:Math.max(0,Math.min(100000,parseInt(fd.get('dl_cost')||'10',10)||0)),
       read_secs:Math.max(1,Math.min(3600,parseInt(fd.get('read_secs')||'10',10)||10)),
       voluntary:{fog:ck('vol_fog')?1:0},
        gate:(function(){var t=String(fd.get('gate_type')||'none');var g={type:t,xp:+(fd.get('gate_xp')||100)};if(t==='stats'){var rq={};if(ck('rq_read_on'))rq.read=+(fd.get('rq_read')||10);if(ck('rq_likes_on'))rq.likes=+(fd.get('rq_likes')||1);if(ck('rq_completed_on'))rq.completed=+(fd.get('rq_completed')||1);g.require=rq;}if(t!=='none'&&ck('gate_login'))g.login=1;return g;})(),
       shots:shots, jar:jar, created_at:new Date().toISOString()
    };
  try{sessionStorage.setItem('game_preview',JSON.stringify(g));}catch(e){alert('Trình duyệt chặn sessionStorage, không xem trước được.');return;}
  window.open('game.html?preview=1','_blank');
}

/* ===== WATERMARK + UPLOAD IMGBB ===== */
(function(){
  const LS = {
    key: 'wm_imgbb_key', logoUrl: 'wm_logo_url', logoData: 'wm_logo_data',
    pos: 'wm_pos_default', size: 'wm_size', opacity: 'wm_opacity'
  };
  const $ = id => document.getElementById(id);
  const apiKeyEl = $('wmApiKey'), posEl = $('wmPos'), logoFileEl = $('wmLogoFile'),
        logoUrlEl = $('wmLogoUrl'), logoPreviewEl = $('wmLogoPreview'),
        sizeEl = $('wmSize'), sizeValEl = $('wmSizeVal'), opEl = $('wmOpacity'), opValEl = $('wmOpacityVal');

  // Khôi phục cấu hình đã lưu
  function loadCfg(){
    apiKeyEl.value = localStorage.getItem(LS.key) || '';
    posEl.value = localStorage.getItem(LS.pos) || 'top';
    sizeEl.value = localStorage.getItem(LS.size) || 30;
    opEl.value = localStorage.getItem(LS.opacity) || 80;
    sizeValEl.textContent = sizeEl.value + '%';
    opValEl.textContent = opEl.value + '%';
    const savedLogoUrl = localStorage.getItem(LS.logoUrl) || '';
    const savedLogoData = localStorage.getItem(LS.logoData) || '';
    if (savedLogoUrl) logoUrlEl.value = savedLogoUrl;
    const src = savedLogoData || savedLogoUrl;
    if (src){ logoPreviewEl.src = src; logoPreviewEl.style.display='inline-block'; }
  }
  loadCfg();

  apiKeyEl.addEventListener('input', ()=> localStorage.setItem(LS.key, apiKeyEl.value.trim()));
  posEl.addEventListener('change', ()=> localStorage.setItem(LS.pos, posEl.value));
  sizeEl.addEventListener('input', ()=>{ sizeValEl.textContent=sizeEl.value+'%'; localStorage.setItem(LS.size, sizeEl.value); });
  opEl.addEventListener('input', ()=>{ opValEl.textContent=opEl.value+'%'; localStorage.setItem(LS.opacity, opEl.value); });

  logoUrlEl.addEventListener('change', ()=>{
    const v = logoUrlEl.value.trim();
    localStorage.setItem(LS.logoUrl, v);
    localStorage.removeItem(LS.logoData);
    if (v){ logoPreviewEl.src = v; logoPreviewEl.style.display='inline-block'; }
  });
  logoFileEl.addEventListener('change', ()=>{
    const f = logoFileEl.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{
      localStorage.setItem(LS.logoData, r.result);
      localStorage.removeItem(LS.logoUrl);
      logoUrlEl.value='';
      logoPreviewEl.src = r.result; logoPreviewEl.style.display='inline-block';
    };
    r.readAsDataURL(f);
  });

  function getLogoSrc(){ return localStorage.getItem(LS.logoData) || localStorage.getItem(LS.logoUrl) || ''; }

  function loadImage(src){
    return new Promise((res,rej)=>{
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = ()=>res(img);
      img.onerror = ()=>rej(new Error('Không tải được ảnh'));
      img.src = src;
    });
  }

  // Vẽ watermark logo lên ảnh gốc, trả về Blob (JPEG chất lượng cao)
  async function drawWatermark(file, logoSrc, pos, sizePct, opacityPct){
    const [baseImg, logoImg] = await Promise.all([
      loadImage(URL.createObjectURL(file)),
      loadImage(logoSrc)
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = baseImg.naturalWidth;
    canvas.height = baseImg.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(baseImg, 0, 0);

    // Giới hạn kích thước logo theo cạnh nhỏ hơn của ảnh, tránh logo bị quá khổ trên ảnh dọc hẹp
    const shortSide = Math.min(canvas.width, canvas.height);
    let logoW = shortSide * (sizePct/100) * (canvas.width > canvas.height ? 1 : 1.6);
    logoW = Math.min(logoW, canvas.width * 0.9);
    const logoH = logoImg.naturalHeight * (logoW / logoImg.naturalWidth);
    const margin = Math.max(8, shortSide * 0.03);
    let x, y, alpha = opacityPct/100;

    if (pos === 'center'){
      x = (canvas.width - logoW)/2; y = (canvas.height - logoH)/2;
      alpha = Math.min(alpha, 0.5); // giữa ảnh luôn để mờ hơn, tránh che nội dung
    } else if (pos === 'top'){
      x = (canvas.width - logoW)/2; y = margin;
    } else if (pos === 'bottom'){
      x = (canvas.width - logoW)/2; y = canvas.height - logoH - margin;
    } else { // fallback: góc trên trái (tl)
      x = margin; y = margin;
    }

    ctx.globalAlpha = alpha;
    ctx.drawImage(logoImg, x, y, logoW, logoH);
    ctx.globalAlpha = 1;

    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  }

  async function uploadToImgbb(blob, apiKey){
    const fd = new FormData();
    fd.append('image', blob, 'wm_'+Date.now()+'.jpg');
    const resp = await fetch('https://api.imgbb.com/1/upload?key='+encodeURIComponent(apiKey), { method:'POST', body: fd });
    const json = await resp.json();
    if (!resp.ok || !json.success) throw new Error(json?.error?.message || 'Upload ImgBB thất bại');
    return json.data.url;
  }

  function addResultToTarget(targetEl, url, multi){
    if (multi){
      const cur = targetEl.value.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
      cur.push(url);
      targetEl.value = cur.join('\n');
    } else {
      targetEl.value = url;
      // cập nhật preview ảnh hiện tại nếu có (chỉ áp dụng cho ô thumb)
    }
  }

  document.querySelectorAll('.wm-box').forEach(box=>{
    const fileEl = box.querySelector('.wm-file');
    const goBtn = box.querySelector('.wm-go');
    const previewEl = box.querySelector('.wm-preview');
    const statusEl = box.querySelector('.wm-status');
    const targetEl = document.getElementById(box.dataset.target);
    const multi = box.dataset.multi === '1';

    goBtn.addEventListener('click', async ()=>{
      const files = Array.from(fileEl.files || []);
      if (!files.length){ statusEl.textContent = 'Hãy chọn ít nhất 1 ảnh.'; statusEl.style.color='#a00'; return; }
      const apiKey = (localStorage.getItem(LS.key)||'').trim();
      if (!apiKey){ statusEl.textContent = '⚠️ Chưa nhập ImgBB API Key ở khối "Cấu hình Watermark" bên dưới.'; statusEl.style.color='#a00'; return; }
      const logoSrc = getLogoSrc();
      if (!logoSrc){ statusEl.textContent = '⚠️ Chưa có logo watermark. Vào khối "Cấu hình Watermark" để thêm.'; statusEl.style.color='#a00'; return; }

      const posSel = box.querySelector('input[type=radio]:checked');
      const pos = posSel ? posSel.value : (localStorage.getItem(LS.pos)||'top');
      const sizePct = +(localStorage.getItem(LS.size)||30);
      const opacityPct = +(localStorage.getItem(LS.opacity)||80);

      previewEl.innerHTML = '';
      goBtn.disabled = true; goBtn.textContent = '⏳ Đang xử lý...';
      statusEl.style.color = '#5a6b87';
      let okCount = 0;

      for (const file of files){
        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'wm-thumb';
        const imgTag = document.createElement('img');
        imgTag.src = URL.createObjectURL(file);
        const tag = document.createElement('div');
        tag.className = 'wm-tag busy';
        tag.textContent = 'Đang xử lý...';
        thumbWrap.appendChild(imgTag);
        thumbWrap.appendChild(tag);
        previewEl.appendChild(thumbWrap);

        try{
          statusEl.textContent = `Đang đóng dấu ${file.name}...`;
          const blob = await drawWatermark(file, logoSrc, pos, sizePct, opacityPct);
          statusEl.textContent = `Đang upload ${file.name} lên ImgBB...`;
          const url = await uploadToImgbb(blob, apiKey);
          addResultToTarget(targetEl, url, multi);
          tag.className = 'wm-tag ok';
          tag.textContent = 'Xong ✓';
          okCount++;
        }catch(err){
          tag.className = 'wm-tag err';
          tag.textContent = 'Lỗi';
          statusEl.textContent = 'Lỗi: ' + err.message;
          statusEl.style.color = '#a00';
        }
      }

      if (okCount === files.length){
        statusEl.textContent = `✅ Đã đóng dấu & upload ${okCount}/${files.length} ảnh, link đã tự điền vào ô phía trên.`;
        statusEl.style.color = '#0a9c4a';
      } else if (okCount > 0){
        statusEl.textContent = `⚠️ Xong ${okCount}/${files.length} ảnh, một số ảnh lỗi (xem ở trên).`;
        statusEl.style.color = '#b8860b';
      }
      goBtn.disabled = false; goBtn.textContent = box.dataset.multi==='1' ? '🖼 Đóng dấu & Upload (nhiều ảnh)' : '🖼 Đóng dấu & Upload';
      fileEl.value = '';
    });
  });
})();
</script>
</body>
</html>
<?php
// end
