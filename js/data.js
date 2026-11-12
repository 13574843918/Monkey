/* =====================================================================
 * 《西游记》西天取经动态路线图  ·  数据层
 * ---------------------------------------------------------------------
 * 本文件只负责「数据」，不含任何 DOM / 渲染 / 交互代码，也不含坐标变换。
 * 考据基准：
 *   · 人民文学出版社百回本《西游记》，回目按第十二回～第一百回顺序。
 *   · 时间按需求设定为贞观十三年（639）出发 — 贞观二十七年（653）抵达灵山。
 *   · 八十一难逐条名录依第九十九回「灾难的簿子」原文（维基文库校），
 *     前 80 难为观音所阅难簿，第 81 难为观音命揭谛追加的归途通天河落水。
 *   · 站点累计难数由难簿自动派生，不再手写，避免两处数据不一致。
 * ===================================================================== */
(function (global) {
  'use strict';

  /** 数字转中文纪年（贞观十三年 … 贞观二十七年） */
  function eraOf(year) {
    var n = year - 626;
    var d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    if (n < 10) return '贞观' + d[n] + '年';
    if (n === 10) return '贞观十年';
    if (n < 20) return '贞观十' + d[n % 10] + '年';
    return '贞观' + d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : '') + '年';
  }

  var META = {
    title: '西游记 · 西天取经图',
    subtitle: '大唐长安 → 西天灵山  ·  十万八千里  ·  九九八十一难',
    yearStart: 639,
    yearEnd: 653,
    totalCalamities: 81,
    mapWidth: 1600,          // 42 站长卷，横向较早期版本放宽
    mapHeight: 720
  };

  /**
   * 取经团队：序位即点亮顺序。
   * absences 为「离队区间」：[from, until)，到达 until 站即归队。
   * 悟空两次被逐：白虎岭（贬书）与真假美猴王（再贬心猿）。
   */
  var TEAM = [
    { id: 'tang',    name: '唐三藏', role: '旃檀功德佛', joinAt: 0, mark: '玄奘', icon: 'av-tang',   absences: [] },
    { id: 'wukong',  name: '孙悟空', role: '斗战胜佛',   joinAt: 2, mark: '心猿', icon: 'av-wukong', absences: [
      { from: 10, until: 11, label: '贬书逐走', chapter: '第二十七回',
        note: '三打白骨精后被唐僧写下贬书逐回花果山；宝象国一难中八戒义激美猴王，方得归队。' },
      { from: 21, until: 22, label: '再贬心猿', chapter: '第五十六回～第五十八回',
        note: '因打杀剪径强盗再遭驱逐，六耳猕猴趁隙冒充；如来辨明真伪，观音亲送悟空归队。' }
    ] },
    { id: 'bailong', name: '白龙马', role: '八部天龙马', joinAt: 3, mark: '意马', icon: 'av-horse',  absences: [] },
    { id: 'bajie',   name: '猪八戒', role: '净坛使者',   joinAt: 5, mark: '木母', icon: 'av-bajie',  absences: [] },
    { id: 'shaseng', name: '沙悟净', role: '金身罗汉',   joinAt: 7, mark: '黄婆', icon: 'av-sha',    absences: [] }
  ];

  /** 神仙援助雷达的两个天界锚点（SVG 用户坐标） */
  var ANCHORS = {
    heaven: { id: 'heaven', name: '天庭 · 凌霄宝殿', short: '天庭', x: 340,  y: 64,  icon: 'i-heaven', desc: '玉帝、太上老君、诸天星君' },
    sea:    { id: 'sea',    name: '南海 · 落伽山',   short: '南海', x: 1260, y: 585, icon: 'i-sea',    desc: '观世音菩萨、诸佛菩萨' }
  };

  /* -------------------------------------------------------------------
   * 路线节点 · 42 站（按百回本回目先后排列，自右向东、向左向西）
   * type       capital 都城 / city 城邦 / temple 寺观 / mountain 山岭
   *            water 河涧 / cave 洞府 / demon 妖氛 / destination 灵山
   * chapters   [起回, 止回]，用于「回目 → 地点」反向检索
   * demons     该地遭遇的妖魔（空数组表示无妖）
   * helpers    出手降妖或解厄者（name + side: heaven / sea / buddha / self / court）
   * aid        援助虚线来源锚点：heaven / sea / null
   * joins      在此处加入团队的成员 id
   * landmark   缩略全图下常驻显示地名
   * sound      点击时播放的国风音效
   * ----------------------------------------------------------------- */
  var WAYPOINTS = [
    {
      id: 'changan', name: '大唐长安', sub: '奉旨西行', year: 639, chapters: [12, 13],
      chapter: '第十二回 · 玄奘秉诚建大会／第十三回 · 陷虎穴金星解厄',
      type: 'capital', x: 1520, y: 330, demons: [], joins: ['tang'],
      helpers: [{ name: '唐太宗李世民', side: 'court' }, { name: '观世音菩萨', side: 'sea' }],
      landmark: true, sound: 'bell',
      story: '贞观十三年，太宗于化生寺建水陆大会，玄奘受观音点化、领御弟圣号，持紫金钵盂、通关文牒，奉旨西行求取大乘真经三藏。唐王亲送郊外，捻土入酒曰：「宁恋本乡一捻土，莫爱他乡万两金。」难簿前四难记其前尘：金蝉遭贬、出胎几杀、满月抛江、寻亲报冤。'
    },
    {
      id: 'shuangchaling', name: '双叉岭', sub: '金星解厄', year: 639, chapters: [13, 13],
      chapter: '第十三回 · 陷虎穴金星解厄 双叉岭伯钦留僧',
      type: 'mountain', x: 1485, y: 400, demons: ['寅将军（老虎精）', '熊山君', '特处士（野牛精）'],
      joins: [], helpers: [{ name: '太白金星', side: 'heaven' }],
      aid: 'heaven', landmark: true, sound: 'sword',
      story: '初出长安即陷虎穴，二随从被寅将军、熊山君、特处士分食，玄奘被缚将死。太白金星化老叟解绳救厄，指引西去；猎户刘伯钦护送至两界山界碑而返。此为西行第一场生死之劫。'
    },
    {
      id: 'liangjieshan', name: '两界山', sub: '五行山 · 心猿归正', year: 640, chapters: [14, 14],
      chapter: '第十四回 · 心猿归正 六贼无踪',
      type: 'mountain', x: 1450, y: 438, demons: ['六贼（眼看喜等）'],
      joins: ['wukong'], helpers: [{ name: '观世音菩萨（紧箍咒）', side: 'sea' }],
      aid: 'sea', landmark: true, sound: 'drum',
      story: '五行山下压着大闹天宫的齐天大圣，已历五百年。玄奘揭去如来六字金帖，悟空脱难拜师，法号「行者」。途遇六贼剪径，尽被悟空打死，师徒初生嫌隙；观音授紧箍儿与定心真言，方收其心。'
    },
    {
      id: 'yingchoujian', name: '蛇盘山鹰愁涧', sub: '意马收缰', year: 640, chapters: [15, 15],
      chapter: '第十五回 · 蛇盘山诸神暗佑 鹰愁涧意马收缰',
      type: 'water', x: 1415, y: 448, demons: ['西海龙王三太子（小白龙）'],
      joins: ['bailong'], helpers: [{ name: '观世音菩萨', side: 'sea' }],
      aid: 'sea', landmark: false, sound: 'wind',
      story: '涧中小龙吞了白马，悟空讨战不敌，只得请来观音。原来乃西海龙王三太子，因纵火烧殿被贬，菩萨令其锯角退鳞、化白马驮负圣僧，皈依正果。自此「意马收缰」，脚力始备。'
    },
    {
      id: 'heifengshan', name: '黑风山 · 观音禅院', sub: '失却袈裟', year: 640, chapters: [16, 17],
      chapter: '第十六回～第十七回 · 观音院僧谋宝贝 黑风山怪窃袈裟',
      type: 'temple', x: 1380, y: 424, demons: ['黑熊精（黑风大王）', '金池长老（贪念）'],
      joins: [], helpers: [{ name: '观世音菩萨', side: 'sea' }],
      aid: 'sea', landmark: false, sound: 'woodfish',
      story: '金池长老见锦襕袈裟起贪心，纵火谋害，反被黑风山熊罴怪趁乱盗去袈裟。悟空三战不能胜，请观音化为凌虚子，以禁箍收伏黑熊精，令其守落伽山后山，做了守山大神。'
    },
    {
      id: 'gaolaozhuang', name: '高老庄', sub: '收降八戒', year: 641, chapters: [18, 19],
      chapter: '第十八回～第十九回 · 观音院唐僧脱难 高老庄行者降魔',
      type: 'city', x: 1344, y: 384, demons: ['猪刚鬣（天蓬元帅）'],
      joins: ['bajie'], helpers: [{ name: '观世音菩萨（先已劝化）', side: 'sea' }, { name: '孙悟空', side: 'self' }],
      aid: 'sea', landmark: true, sound: 'bell',
      story: '高太公家招了个长嘴大耳的妖婿，锁妻占宅。悟空变作翠兰戏降猪刚鬣，方知乃贬下凡尘的天蓬元帅，已受观音戒行、法名「悟能」。玄奘收为二徒，别名八戒，自此担行李、开路先锋。'
    },
    {
      id: 'huangfengling', name: '黄风岭', sub: '黄风怪 · 三昧神风', year: 641, chapters: [20, 21],
      chapter: '第二十回～第二十一回 · 黄风岭唐僧有难 须弥灵吉定风魔',
      type: 'mountain', x: 1309, y: 340, demons: ['黄风大圣（黄毛貂鼠）'],
      joins: [], helpers: [{ name: '灵吉菩萨', side: 'sea' }, { name: '太白金星（指路）', side: 'heaven' }],
      aid: 'sea', landmark: false, sound: 'wind',
      story: '黄风怪一阵三昧神风吹得悟空眼珠酸痛、火眼金睛几不能睁，连护法伽蓝也难近前。太白金星化作老翁点明须弥山灵吉菩萨可降此怪；菩萨以飞龙宝杖、定风丹收之，原来却是灵山脚下偷食琉璃清油的黄毛貂鼠。'
    },
    {
      id: 'liushahe', name: '流沙河', sub: '取经团队集结', year: 641, chapters: [22, 22],
      chapter: '第二十二回 · 八戒大战流沙河 木叉奉法收悟净',
      type: 'water', x: 1274, y: 320, demons: ['沙悟净（卷帘大将）'],
      joins: ['shaseng'], helpers: [{ name: '观世音菩萨', side: 'sea' }, { name: '木叉行者惠岸', side: 'sea' }],
      aid: 'sea', landmark: true, sound: 'wind',
      story: '弱水三千、鹅毛不浮，河妖项挂九颗骷髅。八戒三战未果，悟空请观音遣木叉持红葫芦而来，以九骷髅结筏渡河。卷帘大将皈依，法名「悟净」。至此师徒四众并白马，取经团队集结齐备。'
    },
    {
      id: 'sishi', name: '四圣试禅心', sub: '莫家庄 · 八戒撞天婚', year: 641, chapters: [23, 23],
      chapter: '第二十三回 · 三藏不忘本 四圣试禅心',
      type: 'temple', x: 1239, y: 288, demons: ['黎山老母等四圣（幻化试心）'],
      joins: [], helpers: [{ name: '黎山老母', side: 'buddha' }, { name: '观世音菩萨', side: 'sea' }, { name: '文殊菩萨', side: 'buddha' }, { name: '普贤菩萨', side: 'buddha' }],
      aid: 'sea', landmark: false, sound: 'woodfish',
      story: '黎山老母与观音、文殊、普贤化作富户母女四人，欲以家产招赘试探禅心。唐僧、悟空、沙僧皆不动念，唯八戒起了凡心，被「撞天婚」的珍珠篏锦汗衫缚吊树上，一夜受戒。此难不假妖魔，试的是道心坚否。'
    },
    {
      id: 'wanshoushan', name: '万寿山五庄观', sub: '难活人参', year: 641, chapters: [24, 26],
      chapter: '第二十四回～第二十六回 · 万寿山大仙留故友 五庄观行者窃人参',
      type: 'temple', x: 1204, y: 272, demons: ['镇元大仙（地仙之祖）'],
      joins: [], helpers: [{ name: '观世音菩萨（甘露活树）', side: 'sea' }, { name: '镇元大仙', side: 'buddha' }],
      aid: 'sea', landmark: false, sound: 'woodfish',
      story: '五庄观人参果三千年一开花、三千年一结果，闻之增寿。八戒馋嘴，悟空偷果、怒推仙树，师徒被镇元大仙袖里乾坤擒回。悟空遍求三岛十洲，终请观音以净瓶甘露医活宝树，与镇元子结为兄弟。'
    },
    {
      id: 'baihuling', name: '白虎岭', sub: '三打白骨精', year: 642, chapters: [27, 27],
      chapter: '第二十七回 · 尸魔三戏唐三藏 圣僧恨逐美猴王',
      type: 'demon', x: 1169, y: 264, demons: ['白骨夫人（尸魔）'],
      joins: [], helpers: [{ name: '孙悟空（自行识破）', side: 'self' }],
      aid: null, landmark: true, sound: 'sword', highlight: true,
      story: '尸魔三变村姑、老妇、老翁来诓唐僧，皆被火眼金睛识破打杀。唐僧误信谗言，谓其滥伤无辜，写下贬书逐走悟空。全书最痛的师徒裂痕由此而生——「真假不辨」之难，难在人心，不在妖魔。'
    },
    {
      id: 'baoxiangguo', name: '宝象国', sub: '黄袍怪 · 圣僧变虎', year: 642, chapters: [28, 31],
      chapter: '第二十八回～第三十一回 · 邪魔侵正法 意马忆心猿',
      type: 'city', x: 1134, y: 276, demons: ['黄袍怪（奎木狼星君）'],
      joins: [], helpers: [{ name: '玉皇大帝', side: 'heaven' }, { name: '二十七宿星君', side: 'heaven' }],
      aid: 'heaven', landmark: false, sound: 'sword',
      story: '悟空被逐，八戒沙僧不敌黄袍怪，唐僧被妖法变作猛虎囚于朝堂，白龙马化宫娥行刺受伤。八戒赴花果山义激美猴王，悟空归队降妖；玉帝查得奎木狼私走下凡，罚其往兜率宫烧火。'
    },
    {
      id: 'pingdingshan', name: '平顶山莲花洞', sub: '金银角大王', year: 643, chapters: [32, 35],
      chapter: '第三十二回～第三十五回 · 平顶山功曹传信 莲花洞木母逢灾',
      type: 'cave', x: 1098, y: 306, demons: ['金角大王', '银角大王', '九尾狐狸'],
      joins: [], helpers: [{ name: '太上老君', side: 'heaven' }],
      aid: 'heaven', landmark: true, sound: 'sword',
      story: '二妖持紫金红葫芦、羊脂玉净瓶、幌金绳、芭蕉扇、七星剑五件宝贝，装天装地，把悟空三度装入葫芦。行者变化腾挪，尽骗其宝，反装二妖。老君现身点明：乃看守金炉、银炉的两个童子，特来试禅心。'
    },
    {
      id: 'wujiguo', name: '乌鸡国', sub: '青毛狮子精', year: 643, chapters: [36, 39],
      chapter: '第三十六回～第三十九回 · 心猿正处诸缘伏 劈破傍门见月明',
      type: 'city', x: 1063, y: 348, demons: ['青毛狮子精（假国王）'],
      joins: [], helpers: [{ name: '文殊菩萨', side: 'buddha' }, { name: '太上老君（还魂丹）', side: 'heaven' }],
      aid: 'heaven', landmark: false, sound: 'drum',
      story: '国王托梦诉冤：三年前被妖道推入御水河井中，妖怪变作国王篡位。悟空入井取尸、向老君讨还魂丹救活真主，于金銮殿当众降妖。文殊菩萨现身收伏，原来是奉佛旨来报「三日水厄」之恨的青毛狮子。'
    },
    {
      id: 'huoyundong', name: '火云洞', sub: '红孩儿 · 三昧真火', year: 644, chapters: [40, 42],
      chapter: '第四十回～第四十二回 · 大圣殷勤拜南海 观音慈善缚红孩',
      type: 'cave', x: 1028, y: 392, demons: ['圣婴大王红孩儿'],
      joins: [], helpers: [{ name: '观世音菩萨', side: 'sea' }],
      aid: 'sea', landmark: true, sound: 'sword',
      story: '牛魔王与铁扇公主之子红孩儿，于号山枯松涧炼三昧真火，变化孩童诱擒唐僧，连悟空也被烧得火气攻心。菩萨以净瓶甘露灭火、化莲台为天罡刀，收为善财童子。此即「请圣降妖」之难。'
    },
    {
      id: 'heishuihe', name: '黑水河', sub: '小鼍龙', year: 644, chapters: [43, 43],
      chapter: '第四十三回 · 黑河妖孽擒僧去 西洋龙子捉鼍回',
      type: 'water', x: 993, y: 434, demons: ['小鼍龙（泾河龙王之子）'],
      joins: [], helpers: [{ name: '西海龙王敖闰', side: 'heaven' }, { name: '摩昂太子', side: 'heaven' }],
      aid: 'heaven', landmark: false, sound: 'wind',
      story: '鼍龙变作艄公渡船，中途刮起狂风摄去唐僧、八戒，欲请舅父同享唐僧肉。悟空查其来历，遣摩昂太子率兵擒回问罪。水路之厄虽短，却是龙族亲族相牵的一段插曲。'
    },
    {
      id: 'chechiguo', name: '车迟国', sub: '三仙斗法', year: 645, chapters: [44, 46],
      chapter: '第四十四回～第四十六回 · 法身元运逢车力 心正妖邪度脊关',
      type: 'city', x: 958, y: 452, demons: ['虎力大仙', '鹿力大仙', '羊力大仙'],
      joins: [], helpers: [{ name: '孙悟空（祈雨、坐禅、砍头剖腹）', side: 'self' }],
      aid: null, landmark: false, sound: 'drum',
      story: '三妖道受国王尊为国师，奴役僧众。悟空与八戒、沙僧夜闹三清观，次日在金銮殿赌祈雨、坐禅、隔板猜枚、砍头剖腹下油锅，三仙尽现黄毛虎、白毛鹿、羚羊本相。国王醒悟，敬僧护法。'
    },
    {
      id: 'tongtianhe', name: '通天河', sub: '灵感大王 · 老白鼋', year: 645, chapters: [47, 49],
      chapter: '第四十七回～第四十九回 · 圣僧夜阻通天水 观音救难现鱼篮',
      type: 'water', x: 923, y: 440, demons: ['灵感大王（金鱼精）'],
      joins: [], helpers: [{ name: '观世音菩萨（鱼篮）', side: 'sea' }, { name: '老白鼋', side: 'self' }],
      aid: 'sea', landmark: true, sound: 'wind',
      story: '陈家庄年年以童男童女祭河神，悟空变童男、八戒变童女，夜斗灵感大王。妖精冰封大河，摄走唐僧。菩萨未及梳妆，编竹篮于通天河中收去金鱼精。老白鼋负师徒渡河，托问佛祖寿数——为归途第八十一难埋下伏笔。'
    },
    {
      id: 'jindoushan', name: '金兜山金兜洞', sub: '独角兕大王', year: 646, chapters: [50, 52],
      chapter: '第五十回～第五十二回 · 情乱性从因爱欲 神昏心动遇魔头',
      type: 'cave', x: 888, y: 400, demons: ['独角兕大王（青牛精）'],
      joins: [], helpers: [{ name: '太上老君', side: 'heaven' }, { name: '如来佛祖（金刚琢之喻）', side: 'buddha' }],
      aid: 'heaven', landmark: false, sound: 'sword',
      story: '青牛精持金刚琢，套去金箍棒、哪吒六般兵器、火德星君火具、黄河水伯之水，连十八尊罗汉金丹砂尽被收走。诸天神难伏，悟空问佛根源，方知乃老君坐骑偷了金刚琢下界，老君以芭蕉扇收之。'
    },
    {
      id: 'xiliang', name: '西梁女国', sub: '女儿国逼婚', year: 646, chapters: [53, 54],
      chapter: '第五十三回～第五十四回 · 禅主吞餐怀鬼孕 黄婆运水解邪胎',
      type: 'city', x: 852, y: 356, demons: ['子母河之孕', '如意真仙（守落胎泉）'],
      joins: [], helpers: [{ name: '孙悟空（定计假亲脱网）', side: 'self' }],
      aid: null, landmark: true, sound: 'bell',
      story: '一国尽是女子，唐僧、八戒误饮子母河水而怀胎，悟空取落胎泉解之。女王见玄奘丰姿，愿以一国之富招赘为夫。圣僧假应亲事、登辇送行，于城外脱网西去——不动刀兵的一难，最是考验道心。'
    },
    {
      id: 'dudishan', name: '毒敌山琵琶洞', sub: '蝎子精', year: 647, chapters: [55, 55],
      chapter: '第五十五回 · 色邪淫戏唐三藏 性正修持不坏身',
      type: 'cave', x: 817, y: 306, demons: ['蝎子精（女怪）'],
      joins: [], helpers: [{ name: '昴日星官', side: 'heaven' }],
      aid: 'heaven', landmark: false, sound: 'sword',
      story: '女怪一阵风摄走唐僧，逼配成亲，倒马毒桩连扎悟空头皮、八戒嘴唇，连观音亦言「近他不得」。悟空依菩萨指点请来光明宫昴日星官，星官现双冠子大公鸡本相，两声啼鸣，蝎精现形死绝。'
    },
    {
      id: 'zhenjia', name: '真假美猴王', sub: '六耳猕猴 · 二心搅乱', year: 647, chapters: [56, 58],
      chapter: '第五十六回～第五十八回 · 神狂诛草寇 道昧放心猿／二心搅乱大乾坤',
      type: 'demon', x: 782, y: 274, demons: ['六耳猕猴'],
      joins: [], helpers: [{ name: '如来佛祖', side: 'buddha' }, { name: '观世音菩萨', side: 'sea' }, { name: '地藏王菩萨（谛听）', side: 'buddha' }],
      aid: 'sea', landmark: true, sound: 'drum', highlight: true,
      story: '悟空打杀剪径强盗，唐僧再写贬书驱逐。六耳猕猴趁隙冒名，打伤唐僧、抢走行李，欲自组取经队伍。天地神佛、照妖镜、地藏谛听皆难辨真伪，直闹到灵山，如来道破「二心竞斗」，以金钵盂罩定假行者。观音亲送悟空归队，师徒自此同心。'
    },
    {
      id: 'huoyanshan', name: '火焰山', sub: '三调芭蕉扇', year: 647, chapters: [59, 61],
      chapter: '第五十九回～第六十一回 · 唐三藏路阻火焰山 孙行者三调芭蕉扇',
      type: 'mountain', x: 747, y: 268, demons: ['铁扇公主罗刹女', '牛魔王（大力王）'],
      joins: [], helpers: [{ name: '托塔李天王 / 哪吒三太子', side: 'heaven' }, { name: '四大金刚', side: 'buddha' }, { name: '灵吉菩萨（定风丹）', side: 'sea' }],
      aid: 'heaven', landmark: true, sound: 'sword', highlight: true,
      story: '八百里火焰，寸草不生。悟空一调扇被扇至小须弥，得灵吉定风丹；二调变虫入腹借得假扇，火反更炽；三调变牛魔王骗得真扇，又被牛王变八戒赚回。终请李天王、哪吒与金刚围剿，罗刹献扇，火根永断。'
    },
    {
      id: 'jisaiguo', name: '祭赛国碧波潭', sub: '九头虫', year: 648, chapters: [62, 63],
      chapter: '第六十二回～第六十三回 · 涤垢洗心惟扫塔 缚魔归正乃修身',
      type: 'temple', x: 712, y: 266, demons: ['九头虫（九头驸马）', '万圣龙王', '万圣公主'],
      joins: [], helpers: [{ name: '二郎显圣真君', side: 'heaven' }, { name: '哮天犬', side: 'heaven' }],
      aid: 'heaven', landmark: false, sound: 'sword',
      story: '金光寺塔顶舍利佛宝被碧波潭龙族盗去，僧众蒙冤受刑。悟空、八戒入潭索宝，遇九头虫凶悍，恰逢二郎神携梅山兄弟过境，合力围剿；哮天犬咬落一妖头，九头虫负伤遁北海，佛宝归塔，寺名改「伏龙」。'
    },
    {
      id: 'jingjiling', name: '荆棘岭木仙庵', sub: '树精谈诗', year: 648, chapters: [64, 64],
      chapter: '第六十四回 · 荆棘岭悟能努力 木仙庵三藏谈诗',
      type: 'mountain', x: 677, y: 292, demons: ['十八公（松精）', '孤直公（柏精）', '凌空子（桧精）', '杏仙（杏树精）'],
      joins: [], helpers: [{ name: '猪八戒（筑开荆棘）', side: 'self' }, { name: '孙悟空（识破木妖）', side: 'self' }],
      aid: null, landmark: false, sound: 'woodfish',
      story: '八百里荆棘无路可通，八戒变巨猪拱开一条道。夜半松、柏、桧、竹诸精化作老者，邀唐僧于木仙庵月下联诗，杏仙更欲攀亲。悟空识破草木成精，八戒一钯筑倒诸树。全书最清雅的一难，难在「以文辞乱道心」。'
    },
    {
      id: 'xiaoleiyin', name: '小雷音寺', sub: '黄眉大王', year: 648, chapters: [65, 66],
      chapter: '第六十五回～第六十六回 · 妖邪假设小雷音 诸天神佛皆遭困',
      type: 'cave', x: 642, y: 306, demons: ['黄眉大王（弥勒佛司磬黄眉童儿）'],
      joins: [], helpers: [{ name: '弥勒佛（东来佛祖）', side: 'buddha' }, { name: '亢金龙', side: 'heaven' }],
      aid: 'heaven', landmark: true, sound: 'woodfish',
      story: '妖怪假设小雷音，假扮如来，唐僧误拜被擒。金铙合住悟空，亢金龙以角钻透相救；后天神尽被搭包收去。弥勒佛现身，教悟空变熟瓜入其腹中，方收黄眉童儿与后天袋、敲磬槌。假佛之难，讥的是「以貌取法」。'
    },
    {
      id: 'qijueshan', name: '七绝山稀柿衕', sub: '红鳞大蟒', year: 648, chapters: [67, 67],
      chapter: '第六十七回 · 拯救驼罗禅性稳 脱离秽污道心清',
      type: 'mountain', x: 607, y: 344, demons: ['红鳞大蟒'],
      joins: [], helpers: [{ name: '猪八戒（变猪拱路）', side: 'self' }, { name: '孙悟空', side: 'self' }],
      aid: null, landmark: false, sound: 'wind',
      story: '驼罗庄外七绝山，烂柿积淤成衕，臭秽难行，又有红鳞大蟒夜食人畜。悟空、八戒合力除蟒，八戒现巨猪之相，一路拱开稀柿，庄民以粮相谢。难簿谓之「稀柿衕秽阻」——最不体面、却最见实干的一难。'
    },
    {
      id: 'zhuziguo', name: '朱紫国', sub: '赛太岁 · 金圣宫娘娘', year: 649, chapters: [68, 71],
      chapter: '第六十八回～第七十一回 · 朱紫国唐僧论前世 孙行者施为三折肱',
      type: 'city', x: 571, y: 380, demons: ['赛太岁（金毛犼）'],
      joins: [], helpers: [{ name: '观世音菩萨', side: 'sea' }, { name: '张紫阳真人（旧棕衣）', side: 'heaven' }],
      aid: 'sea', landmark: true, sound: 'bell',
      story: '国王因金圣宫娘娘被麒麟山赛太岁掳去，忧思成疾。悟空以马兜铃等三味药「悬丝诊脉」医王，又变作小妖「有来有去」赚得紫金铃。正要烧死妖怪，观音现身：乃其坐骑金毛犼，为报「拆凤三年」之因果而来。'
    },
    {
      id: 'pansidong', name: '盘丝洞', sub: '七情迷没 · 蜘蛛精', year: 649, chapters: [72, 72],
      chapter: '第七十二回 · 盘丝洞七情迷本 濯垢泉八戒忘形',
      type: 'cave', x: 536, y: 412, demons: ['七个蜘蛛精'],
      joins: [], helpers: [{ name: '孙悟空（自行收蛛）', side: 'self' }, { name: '土地神（报信）', side: 'heaven' }],
      aid: null, landmark: true, sound: 'sword',
      story: '七个女妖于濯垢泉沐浴，脐中吐丝结网，把唐僧吊在盘丝洞。悟空变饿鹰叼走衣裳，八戒变鲇鱼戏水反被缠住。行者解围后一把火烧了洞府，七蛛逃往师兄百眼魔君处。难簿以「七情迷没」名之，蛛丝即情丝。'
    },
    {
      id: 'huanghuaguan', name: '黄花观', sub: '百眼魔君 · 多目怪', year: 649, chapters: [73, 73],
      chapter: '第七十三回 · 情因旧恨生灾毒 心主遭魔幸破光',
      type: 'temple', x: 501, y: 428, demons: ['百眼魔君（蜈蚣精）'],
      joins: [], helpers: [{ name: '毗蓝婆菩萨', side: 'buddha' }, { name: '昴日星官（绣花针之母）', side: 'heaven' }],
      aid: 'sea', landmark: true, sound: 'sword',
      story: '蜘蛛精师兄以毒茶药倒唐僧、八戒、沙僧，两胁千眼放金光罩住悟空，连金箍棒也近不得。黎山老母指点请来紫云山千花洞毗蓝婆，菩萨以儿子昴日星官眼中炼出的绣花针破光，收蜈蚣精去看守门户。'
    },
    {
      id: 'shituoling', name: '狮驼岭狮驼国', sub: '三魔据国', year: 649, chapters: [74, 77],
      chapter: '第七十四回～第七十七回 · 长庚传报魔头狠 群魔欺本性',
      type: 'demon', x: 466, y: 400, demons: ['青狮精', '白象精', '大鹏金翅雕'],
      joins: [], helpers: [{ name: '如来佛祖', side: 'buddha' }, { name: '文殊菩萨 / 普贤菩萨', side: 'buddha' }],
      aid: 'heaven', landmark: true, sound: 'drum', highlight: true,
      story: '八百里狮驼岭，尸骸如林；狮驼国一城之人尽被吞食。三魔设「阴阳二气瓶」，又诈称已吃唐僧，令悟空痛哭上灵山。如来亲至，唤文殊、普贤收青狮白象，以金光罩定大鹏——全书最惨烈一劫，须佛祖亲临方解。'
    },
    {
      id: 'biqiuguo', name: '比丘国', sub: '白鹿精 · 小儿心肝', year: 650, chapters: [78, 79],
      chapter: '第七十八回～第七十九回 · 比丘怜子遣阴神 当朝正主救婴儿',
      type: 'city', x: 431, y: 372, demons: ['白鹿精（南极寿星坐骑）', '白面狐狸（美后）'],
      joins: [], helpers: [{ name: '南极寿星', side: 'heaven' }],
      aid: 'heaven', landmark: false, sound: 'sword',
      story: '国丈献美后，国王病弱，索一千一百一十一个小儿心肝作药引，鹅笼悬于街巷。悟空令城隍土地摄走群儿，自己变作唐僧剖心，现「一心」之相；寿星赶来收伏白鹿，狐狸被八戒一钯筑死。'
    },
    {
      id: 'wudidong', name: '陷空山无底洞', sub: '金鼻白毛老鼠精', year: 651, chapters: [80, 83],
      chapter: '第八十回～第八十三回 · 姹女育阳求配偶 心猿护主识妖邪',
      type: 'cave', x: 396, y: 392, demons: ['地涌夫人（金鼻白毛老鼠精）'],
      joins: [], helpers: [{ name: '托塔李天王', side: 'heaven' }, { name: '哪吒三太子', side: 'heaven' }],
      aid: 'heaven', landmark: false, sound: 'sword',
      story: '女怪自缚松林求救，入寺后摄唐僧入无底洞逼婚，供奉「父王李天王、兄长哪吒」牌位。悟空据此上天告御状，天王率天兵下界，方知是灵山偷食香花宝烛、被认作义女的半截观音之鼠，遂以缚妖索收之。'
    },
    {
      id: 'miefaguo', name: '灭法国', sub: '一夜剃尽君臣发', year: 651, chapters: [84, 84],
      chapter: '第八十四回 · 难灭伽持圆大觉 法王成正体天然',
      type: 'city', x: 361, y: 420, demons: ['灭法国王（杀僧之愿）'],
      joins: [], helpers: [{ name: '孙悟空（剃发警君）', side: 'self' }, { name: '观音菩萨（预告）', side: 'sea' }],
      aid: null, landmark: false, sound: 'woodfish',
      story: '国王许愿要杀一万名和尚，已杀九千九百九十六个，只待四僧凑数。悟空夜入皇城，以毫毛变千百剃刀，把国王、妃嫔、百官一夜剃成光头。君臣惊悟，改国号为「钦法国」，反以国礼送行。不伤一命而化一国，是最巧的一难。'
    },
    {
      id: 'yinwushan', name: '隐雾山折岳连环洞', sub: '南山大王', year: 651, chapters: [85, 86],
      chapter: '第八十五回～第八十六回 · 心猿妒木母 魔主计吞禅',
      type: 'cave', x: 326, y: 448, demons: ['南山大王（艾叶花皮豹子精）'],
      joins: [], helpers: [{ name: '孙悟空（自行破洞）', side: 'self' }, { name: '猪八戒', side: 'self' }],
      aid: null, landmark: false, sound: 'sword',
      story: '豹子精用「分瓣梅花计」调开三徒，一阵风摄走唐僧，又以假人头诓称师父已死，师徒哭了一场。悟空变水鼠潜入洞中，救出唐僧与樵夫，八戒一钯筑死豹精。此难写「以假乱真」，与白骨岭、六耳猕猴遥相呼应。'
    },
    {
      id: 'fengxianjun', name: '凤仙郡', sub: '三年亢旱 · 米山面山', year: 651, chapters: [87, 87],
      chapter: '第八十七回 · 凤仙郡冒天止雨 孙大圣劝善施霖',
      type: 'city', x: 290, y: 430, demons: ['亢旱之灾（非妖）'],
      joins: [], helpers: [{ name: '玉皇大帝', side: 'heaven' }, { name: '东海龙王敖广', side: 'heaven' }],
      aid: 'heaven', landmark: false, sound: 'wind',
      story: '郡侯推倒斋天素供、口出恶言，玉帝立三事于披香殿：拳大之鸡啄尽米山、哈巴狗舔尽面山、灯焰烧断黄金大锁，方许下雨。悟空上天问明原委，劝郡侯率众焚香拜天、广行善事，三事顿消，甘霖普降。无妖可降，难在「天条与人心的和解」。'
    },
    {
      id: 'yuhuazhou', name: '玉华州', sub: '九头狮子 · 兵器失窃', year: 652, chapters: [88, 90],
      chapter: '第八十八回～第九十回 · 禅到玉华施法会 心猿木母授门人',
      type: 'city', x: 255, y: 400, demons: ['九灵元圣（九头狮子）', '黄狮精'],
      joins: [], helpers: [{ name: '太乙救苦天尊', side: 'heaven' }],
      aid: 'heaven', landmark: true, sound: 'sword',
      story: '三位王子拜悟空、八戒、沙僧为师，仿造金箍棒、九齿钯、降妖杖，夜中被黄狮精盗去，设「钉钯宴」。竹节山九灵元圣一口衔住唐僧并三徒，悟空请来其主人太乙救苦天尊，狮奴喝破，九头狮俯首归天。'
    },
    {
      id: 'jinpingfu', name: '金平府青龙山', sub: '三只犀牛精', year: 652, chapters: [91, 92],
      chapter: '第九十一回～第九十二回 · 金平府元夜观灯 玄英洞唐僧供状',
      type: 'temple', x: 220, y: 366, demons: ['辟寒大王', '辟暑大王', '辟尘大王（犀牛精）'],
      joins: [], helpers: [{ name: '四木禽星', side: 'heaven' }, { name: '西海龙王敖闰', side: 'heaven' }],
      aid: 'heaven', landmark: false, sound: 'drum',
      story: '元宵观灯，三妖假充佛像受金灯香油，一阵风摄走唐僧。悟空上天请来角木蛟、斗木獬、奎木狼、井木犴四木禽星，犀牛精畏木禽，遁入西海又被龙子拦回。锯角献佛、免了地方供油之累，「赶捉犀牛」遂成第七十七难。'
    },
    {
      id: 'tianzhuguo', name: '天竺国', sub: '玉兔招婚', year: 652, chapters: [93, 95],
      chapter: '第九十三回～第九十五回 · 给孤园问古谈因 天竺国朝王遇偶',
      type: 'city', x: 185, y: 340, demons: ['玉兔精（假公主）'],
      joins: [], helpers: [{ name: '太阴星君', side: 'heaven' }, { name: '嫦娥仙子', side: 'heaven' }],
      aid: 'heaven', landmark: true, sound: 'bell',
      story: '去灵山仅半程，公主抛绣球招亲，正中玄奘。悟空识得妖气，于毛颖山追出捣药玉杵，太阴星君与嫦娥降临，说明素娥仙子思凡、玉兔报一掌之仇的因果，收玉兔回广寒宫，真公主归位。'
    },
    {
      id: 'tongtaifu', name: '铜台府地灵县', sub: '寇员外 · 监禁之难', year: 652, chapters: [96, 97],
      chapter: '第九十六回～第九十七回 · 寇员外喜待高僧 唐长老不贪富贵',
      type: 'city', x: 150, y: 352, demons: ['强盗（凡人之祸）'],
      joins: [], helpers: [{ name: '孙悟空（显魂辩冤）', side: 'self' }, { name: '地藏王菩萨（延寿）', side: 'buddha' }],
      aid: null, landmark: false, sound: 'woodfish',
      story: '寇员外斋僧圆满，留唐僧盘桓半月，归途遭强盗劫财、员外被踢身死，其妻诬告四僧，师徒锒铛入狱。悟空变蜢虫入宅、假作员外之魂陈情，又赴地府讨回一纪阳寿，寇洪还魂，冤案得雪。最后一难竟出自人间官府。'
    },
    {
      id: 'lingyundu', name: '凌云渡', sub: '脱去凡胎', year: 653, chapters: [98, 98],
      chapter: '第九十八回 · 猿熟马驯方脱壳 功成行满见真如',
      type: 'water', x: 115, y: 326, demons: [],
      joins: [], helpers: [{ name: '接引佛祖（无底船）', side: 'buddha' }],
      aid: 'sea', landmark: true, sound: 'bell',
      story: '玉真观金顶大仙引路，至凌云渡独木桥不可行。接引佛祖撑一只无底船而来，唐僧见上游漂下一具死尸，正是自己的凡胎——悟空笑指：「师父莫怕，那个原来是你。」脱壳之后，身轻体健，方得上灵山。'
    },
    {
      id: 'daleiyinsi', name: '大雷音寺', sub: '灵山 · 功成行满', year: 653, chapters: [98, 100],
      chapter: '第九十八回～第一百回 · 猿熟马驯方脱壳 功成行满见真如',
      type: 'destination', x: 80, y: 300, demons: [],
      joins: [], helpers: [{ name: '如来佛祖', side: 'buddha' }, { name: '阿傩、伽叶', side: 'buddha' }, { name: '观世音菩萨（查难簿）', side: 'sea' }],
      aid: 'sea', landmark: true, sound: 'bell', highlight: true,
      story: '登灵鹫峰谒见如来，阿傩伽叶索人事，初传无字之经，师徒复返换取有字真经五千零四十八卷。观音查难簿见止八十难，命揭谛赶上金刚再生一难：归途通天河白鼋问寿不答，淬水湿经、晒经石上留痕。九九归真，五圣成真。'
    }
  ];

  /* -------------------------------------------------------------------
   * 经典场景（剧场数据，仍属数据层）：为每一站塑造一段「人物 + 对话 + 动作」。
   * set   背景：capital 都城 / city 城邦 / temple 寺观 / mountain 山岭
   *        river 河涧 / cave 洞府 / forest 林泉 / palace 殿廷 / sky 天界
   * cast  登台角色：字符串 = 取经团队成员（tang/wukong/bajie/shaseng/bailong）；
   *        对象 {w, k, t?}：w=称谓(亦作台词 who)，k=立绘类型
   *        （demon 妖怪 / god 神仙 / folk 凡人），t=主体配色（妖/神按名著色）。
   * lines 台词：w 须与 cast 中某成员一致；a=动作 cue（swing 挥击 / cast 施法 /
   *        laugh 奸笑 / fear 惊惧 / bow 降服 / descend 降临 / cry 悲泣 /
   *        warn 示警 / boast 夸口 / think 思索 / calm 静叙）。
   * 台词依百回本原著经典对白凝练，无外部依赖。
   * ----------------------------------------------------------------- */
  var SCENES = [
    /* 0 大唐长安 */ { set: 'capital', cast: ['tang', { w: '唐王', k: 'folk' }, { w: '观音菩萨', k: 'god', t: '#3c9d6e' }],
      lines: [
        { w: '唐王', t: '御弟，此去西天早取真经；宁恋本乡一捻土，莫爱他乡万两金。', a: 'bow' },
        { w: 'tang', t: '贫僧定不负陛下所托，去来得三五年便回。', a: 'calm' },
        { w: '观音菩萨', t: '玄奘，大乘佛法在西天，可速去求取真经。', a: 'descend' } ] },
    /* 1 双叉岭 */ { set: 'mountain', cast: ['tang', { w: '寅将军', k: 'demon', t: '#7a4a3a' }, { w: '太白金星', k: 'god', t: '#e8e2c8' }],
      lines: [
        { w: '寅将军', t: '哈哈，两个和尚，正合我肚肠！', a: 'laugh' },
        { w: 'tang', t: '出家人，怎料命悬一线……', a: 'fear' },
        { w: '太白金星', t: '唐僧休慌，我太白金星来也！', a: 'descend' },
        { w: '太白金星', t: '此去两界山，自有取经人在等你。', a: 'calm' } ] },
    /* 2 两界山 */ { set: 'mountain', cast: ['tang', { w: 'wukong' }, { w: '观音菩萨', k: 'god', t: '#3c9d6e' }],
      lines: [
        { w: 'wukong', t: '师父师父！我压在这山下五百年，快揭了那金帖！', a: 'cry' },
        { w: 'tang', t: '你这猴头，揭了帖我便救你出来。', a: 'calm' },
        { w: '观音菩萨', t: '悟空，此去保唐僧西行，休得妄为。', a: 'descend' },
        { w: 'wukong', t: '俺老孙去也！', a: 'warn' } ] },
    /* 3 鹰愁涧 */ { set: 'river', cast: ['tang', { w: 'wukong' }, { w: '小白龙', k: 'demon', t: '#cdd6e0' }, { w: '观音菩萨', k: 'god', t: '#3c9d6e' }],
      lines: [
        { w: 'wukong', t: '何方孽龙，敢吞我师父白马！', a: 'warn' },
        { w: '小白龙', t: '我是西海龙王三太子，误吞了白马。', a: 'fear' },
        { w: '观音菩萨', t: '锯角退鳞，化白马驮负圣僧。', a: 'descend' },
        { w: '小白龙', t: '弟子愿皈依正果。', a: 'bow' } ] },
    /* 4 黑风山 */ { set: 'temple', cast: ['tang', { w: 'wukong' }, { w: '金池长老', k: 'folk' }, { w: '黑熊精', k: 'demon', t: '#4a3326' }, { w: '观音菩萨', k: 'god', t: '#3c9d6e' }],
      lines: [
        { w: '金池长老', t: '这锦襕袈裟，好生光彩……', a: 'think' },
        { w: '黑熊精', t: '趁火打劫，袈裟归我了！', a: 'laugh' },
        { w: 'wukong', t: '偷袈裟的熊罴，吃我一棒！', a: 'swing' },
        { w: '观音菩萨', t: '孽畜，皈依落伽山做个守山大神。', a: 'bow' } ] },
    /* 5 高老庄 */ { set: 'city', cast: ['tang', { w: 'wukong' }, { w: 'bajie' }, { w: '高太公', k: 'folk' }],
      lines: [
        { w: '高太公', t: '长老，我女婿是个长嘴大耳的妖怪！', a: 'fear' },
        { w: 'bajie', t: '俺老猪在此等了多年，正要随师父取经！', a: 'boast' },
        { w: 'wukong', t: '妖怪，吃俺老孙一棒！', a: 'swing' },
        { w: 'bajie', t: '哥哥住手！我师父是唐僧，菩萨教我等他的。', a: 'bow' } ] },
    /* 6 黄风岭 */ { set: 'mountain', cast: ['tang', { w: 'wukong' }, { w: '黄风怪', k: 'demon', t: '#caa15a' }, { w: '灵吉菩萨', k: 'god', t: '#6bbf9e' }],
      lines: [
        { w: '黄风怪', t: '三昧神风，吹得你火眼金睛也睁不开！', a: 'cast' },
        { w: 'wukong', t: '哎哟，眼珠子酸疼，这风好生厉害！', a: 'cry' },
        { w: '灵吉', t: '悟空莫慌，我这飞龙宝杖专降此怪。', a: 'descend' },
        { w: '灵吉', t: '此乃灵山偷油之貂鼠，随我回去。', a: 'bow' } ] },
    /* 7 流沙河 */ { set: 'river', cast: ['tang', { w: 'wukong' }, { w: 'bajie' }, { w: 'shaseng' }, { w: '木叉行者', k: 'god', t: '#5a8fd0' }],
      lines: [
        { w: 'shaseng', t: '哪个敢来流沙河？吃我一杖！', a: 'swing' },
        { w: 'bajie', t: '你这河妖，俺老猪来也！', a: 'swing' },
        { w: '木叉', t: '悟净，且休无礼，唐僧是你师父。', a: 'descend' },
        { w: 'shaseng', t: '弟子愿保唐僧，皈依正果。', a: 'bow' } ] },
    /* 8 四圣试禅心 */ { set: 'temple', cast: ['tang', { w: 'wukong' }, { w: 'bajie' }, { w: '黎山老母', k: 'god', t: '#b07cc0' }],
      lines: [
        { w: '黎山老母', t: '我有三女，欲招赘一位长老。', a: 'think' },
        { w: 'bajie', t: '师父，招亲这等好事，怎生不去？', a: 'boast' },
        { w: 'wukong', t: '八戒，你且去，我们在此等你。', a: 'laugh' },
        { w: '黎山老母', t: '好个八戒，且绷在树上受用。', a: 'bow' } ] },
    /* 9 五庄观 */ { set: 'temple', cast: ['tang', { w: 'wukong' }, { w: '清风', k: 'folk' }, { w: '镇元大仙', k: 'god', t: '#5fae8c' }, { w: '观音菩萨', k: 'god', t: '#3c9d6e' }],
      lines: [
        { w: '清风', t: '唐僧，这人参果你为何不吃？', a: 'think' },
        { w: 'wukong', t: '俺老孙摘他几个尝尝鲜！', a: 'warn' },
        { w: '镇元', t: '泼猴，推倒我宝树，赔我树来！', a: 'swing' },
        { w: '观音菩萨', t: '镇元大仙，待我救活宝树。', a: 'descend' } ] },
    /* 10 白虎岭 */ { set: 'mountain', cast: ['tang', { w: 'wukong' }, { w: '白骨精', k: 'demon', t: '#9fb0a6' }],
      lines: [
        { w: '白骨精', t: '送饭的村姑来也，长老请用。', a: 'laugh' },
        { w: 'wukong', t: '妖精，吃俺老孙一棒！', a: 'swing' },
        { w: '白骨精', t: '长老，这猴头滥杀无辜！', a: 'laugh' },
        { w: 'tang', t: '猴头，执此为照，再不要你做徒弟了！', a: 'fear' } ] },
    /* 11 宝象国 */ { set: 'palace', cast: ['tang', { w: 'bajie' }, { w: '白龙马', k: 'bailong' }, { w: '黄袍怪', k: 'demon', t: '#6f8f4f' }, { w: 'wukong' }],
      lines: [
        { w: '黄袍怪', t: '那唐僧是我岳丈家和尚，变作猛虎了！', a: 'laugh' },
        { w: '白龙马', t: '二师兄，救师父去，我变宫娥刺他！', a: 'warn' },
        { w: 'bajie', t: '罢罢，我去请大师兄来。', a: 'bow' },
        { w: 'wukong', t: '妖精，还我师父来！', a: 'swing' } ] },
    /* 12 平顶山 */ { set: 'mountain', cast: ['tang', { w: 'wukong' }, { w: '金角大王', k: 'demon', t: '#d9b24a' }, { w: '银角大王', k: 'demon', t: '#cfc0a0' }, { w: '太上老君', k: 'god', t: '#b9bcc0' }],
      lines: [
        { w: '银角', t: '那唐僧乃金蝉长老，吃了延寿长生！', a: 'laugh' },
        { w: 'wukong', t: '你这两个看炉的童子，也敢称大王？', a: 'warn' },
        { w: '银角', t: '移山压你！', a: 'cast' },
        { w: '太上老君', t: '童儿们，随我回兜率宫去。', a: 'bow' } ] },
    /* 13 乌鸡国 */ { set: 'palace', cast: ['tang', { w: 'wukong' }, { w: '乌鸡国王', k: 'folk' }, { w: '文殊菩萨', k: 'god', t: '#5a8fd0' }],
      lines: [
        { w: '乌鸡国王', t: '国师害我，推我井中三年！', a: 'fear' },
        { w: 'wukong', t: '师父，井中有国王尸首，待我救活。', a: 'warn' },
        { w: '文殊', t: '此乃我坐骑青毛狮子，报那一鞭之仇。', a: 'descend' },
        { w: '文殊', t: '悟空，还我青狮去罢。', a: 'bow' } ] },
    /* 14 火云洞 */ { set: 'cave', cast: ['tang', { w: 'wukong' }, { w: '红孩儿', k: 'demon', t: '#d6452f' }, { w: '观音菩萨', k: 'god', t: '#3c9d6e' }],
      lines: [
        { w: '红孩儿', t: '三昧真火，烧得你猴头叫娘！', a: 'cast' },
        { w: 'wukong', t: '不好，这火焠得俺毫毛都卷！', a: 'cry' },
        { w: '观音', t: '红孩儿，你父牛魔王，可认得我？', a: 'descend' },
        { w: '观音', t: '善财童子，随我去罢。', a: 'bow' } ] },
    /* 15 黑水河 */ { set: 'river', cast: ['tang', { w: 'bajie' }, { w: '小鼍龙', k: 'demon', t: '#3f7a86' }, { w: '西海龙王', k: 'god', t: '#3f7a86' }],
      lines: [
        { w: '小鼍龙', t: '捉得唐僧，请舅爷来吃！', a: 'laugh' },
        { w: 'bajie', t: '妖怪，俺老猪来也！', a: 'swing' },
        { w: '西海龙王', t: '逆侄，竟敢擒我同门？', a: 'descend' },
        { w: '西海龙王', t: '带这孽障回西海发落。', a: 'bow' } ] },
    /* 16 车迟国 */ { set: 'temple', cast: ['tang', { w: 'wukong' }, { w: '虎力大仙', k: 'demon', t: '#caa15a' }, { w: '鹿力大仙', k: 'demon', t: '#9aa86a' }, { w: '羊力大仙', k: 'demon', t: '#c9b88a' }],
      lines: [
        { w: '虎力', t: '我道家与你们和尚赌赛求雨！', a: 'boast' },
        { w: 'wukong', t: '求雨？俺老孙唤风伯雨师便是。', a: 'warn' },
        { w: '鹿力', t: '砍头再生，你能么？', a: 'laugh' },
        { w: 'wukong', t: '哈哈，你头砍下也长不出！', a: 'swing' } ] },
    /* 17 通天河 */ { set: 'river', cast: ['tang', { w: 'bajie' }, { w: '灵感大王', k: 'demon', t: '#d98a4a' }, { w: '观音菩萨', k: 'god', t: '#3c9d6e' }],
      lines: [
        { w: '灵感', t: '陈家童男童女，年年祭我！', a: 'laugh' },
        { w: 'bajie', t: '妖怪，今日吃俺老猪一钯！', a: 'swing' },
        { w: '观音', t: '此乃我莲花池金鱼，每日听经走脱。', a: 'descend' },
        { w: '观音', t: '渔篮收了去罢。', a: 'bow' } ] },
    /* 18 金兜山 */ { set: 'mountain', cast: ['tang', { w: 'wukong' }, { w: '独角兕大王', k: 'demon', t: '#9aa0a6' }, { w: '太上老君', k: 'god', t: '#b9bcc0' }],
      lines: [
        { w: '青牛', t: '任你天兵天将，破不得我金刚琢！', a: 'cast' },
        { w: 'wukong', t: '这圈子好生厉害，众神兵器都被套了！', a: 'cry' },
        { w: '太上老君', t: '牛儿，还不现形！', a: 'descend' },
        { w: '太上老君', t: '悟空，还我青牛去。', a: 'bow' } ] },
    /* 19 西梁女国 */ { set: 'palace', cast: ['tang', { w: 'wukong' }, { w: 'bajie' }, { w: '女儿国王', k: 'folk' }],
      lines: [
        { w: '女王', t: '御弟哥哥，愿招你为夫，与我主掌江山。', a: 'think' },
        { w: 'tang', t: '贫僧许身佛门，不敢从命。', a: 'bow' },
        { w: 'bajie', t: '师父，倒不如招了我老猪……', a: 'boast' },
        { w: 'wukong', t: '师父莫慌，趁今日换了关文便走。', a: 'warn' } ] },
    /* 20 琵琶洞 */ { set: 'cave', cast: ['tang', { w: 'wukong' }, { w: '蝎子精', k: 'demon', t: '#a06bb0' }, { w: '昴日星官', k: 'god', t: '#e0b94a' }],
      lines: [
        { w: '蝎子精', t: '唐长老，陪我做个夫妻。', a: 'laugh' },
        { w: 'wukong', t: '这蝎子倒有些蜇人，俺老孙怕了！', a: 'cry' },
        { w: '昴日星官', t: '公鸡一声，管教她现形！', a: 'descend' },
        { w: '昴日星官', t: '咯咯——（蝎子精现形毙命）', a: 'cast' } ] },
    /* 21 真假美猴王 */ { set: 'sky', cast: [{ w: 'wukong' }, { w: '六耳猕猴', k: 'demon', t: '#8a6a3a' }, { w: '如来佛祖', k: 'god', t: '#e0b94a' }],
      lines: [
        { w: '六耳', t: '我便是真悟空，你这假猢狲！', a: 'laugh' },
        { w: 'wukong', t: '妖精，还我师父来！', a: 'swing' },
        { w: '如来', t: '汝等且住，待我辨明真伪。', a: 'descend' },
        { w: '如来', t: '六耳猕猴，还不现形！', a: 'bow' } ] },
    /* 22 火焰山 */ { set: 'mountain', cast: ['tang', { w: 'wukong' }, { w: '铁扇公主', k: 'demon', t: '#3f9e8c' }, { w: '牛魔王', k: 'demon', t: '#7a3a2a' }],
      lines: [
        { w: '铁扇', t: '泼猴，你坑陷我儿红孩儿，吃我一扇！', a: 'cast' },
        { w: 'wukong', t: '这扇风把俺吹出五万里！', a: 'cry' },
        { w: '牛魔王', t: '猢狲，还我芭蕉扇来！', a: 'swing' },
        { w: 'wukong', t: '借天兵围了摩云洞，终得宝扇灭火！', a: 'warn' } ] },
    /* 23 祭赛国 */ { set: 'temple', cast: ['tang', { w: 'wukong' }, { w: '九头虫', k: 'demon', t: '#4f9e7a' }, { w: '二郎显圣真君', k: 'god', t: '#4aa0c0' }],
      lines: [
        { w: '九头虫', t: '佛宝是我岳丈偷来，与汝何干！', a: 'laugh' },
        { w: 'wukong', t: '妖怪，还我佛宝！', a: 'swing' },
        { w: '二郎神', t: '吾领梅山兄弟，助你擒此怪。', a: 'descend' },
        { w: '二郎神', t: '九头虫负痛逃了，佛宝归塔。', a: 'bow' } ] },
    /* 24 荆棘岭 */ { set: 'forest', cast: ['tang', { w: 'wukong' }, { w: '荆棘岭树精', k: 'demon', t: '#6f9a5a' }],
      lines: [
        { w: '树精', t: '唐僧，月下谈诗，何不快哉？', a: 'think' },
        { w: 'tang', t: '诸公雅致，贫僧奉陪。', a: 'calm' },
        { w: 'wukong', t: '师父，这些乃妖树成精，吃俺一棒！', a: 'swing' },
        { w: '树精', t: '哎呀，我等本是木仙！', a: 'laugh' } ] },
    /* 25 小雷音 */ { set: 'temple', cast: ['tang', { w: 'wukong' }, { w: '黄眉大王', k: 'demon', t: '#e0c24a' }, { w: '弥勒佛', k: 'god', t: '#e0b94a' }],
      lines: [
        { w: '黄眉', t: '我是黄眉，你如来也奈何我不得！', a: 'laugh' },
        { w: 'wukong', t: '这袋子把俺和人马都装了！', a: 'cry' },
        { w: '弥勒', t: '悟空，我这瓜田熟了，引他来吞。', a: 'descend' },
        { w: '弥勒', t: '黄眉童儿，还不现形！', a: 'bow' } ] },
    /* 26 七绝山 */ { set: 'forest', cast: ['tang', { w: 'bajie' }, { w: '红鳞大蟒', k: 'demon', t: '#c0504a' }, { w: 'wukong' }],
      lines: [
        { w: '大蟒', t: '稀柿衕臭不可当，正是我巢穴！', a: 'laugh' },
        { w: 'bajie', t: '看俺老猪拱开这烂路！', a: 'swing' },
        { w: 'wukong', t: '妖蟒，吃我一棒！', a: 'swing' } ] },
    /* 27 朱紫国 */ { set: 'palace', cast: ['tang', { w: 'wukong' }, { w: '金圣宫娘娘', k: 'folk' }, { w: '赛太岁', k: 'demon', t: '#d65a8a' }, { w: '观音菩萨', k: 'god', t: '#3c9d6e' }],
      lines: [
        { w: '金圣宫', t: '那妖怪有紫金铃，碰不得！', a: 'fear' },
        { w: 'wukong', t: '待我变作侍女，盗他铃铛。', a: 'warn' },
        { w: '赛太岁', t: '我的铃儿怎地不响？', a: 'laugh' },
        { w: '观音', t: '此乃我坐骑金毛犼，收回去罢。', a: 'bow' } ] },
    /* 28 盘丝洞 */ { set: 'cave', cast: ['tang', { w: 'wukong' }, { w: 'bajie' }, { w: '蜘蛛精', k: 'demon', t: '#9a6bb0' }],
      lines: [
        { w: '蜘蛛精', t: '唐僧哥哥，来浴汤中耍子。', a: 'laugh' },
        { w: 'wukong', t: '妖精吐丝，俺变饿鹰叼了衣裳！', a: 'swing' },
        { w: 'bajie', t: '俺老猪变鲇鱼戏水……', a: 'boast' },
        { w: 'wukong', t: '烧了这盘丝洞！', a: 'warn' } ] },
    /* 29 黄花观 */ { set: 'temple', cast: ['tang', { w: 'wukong' }, { w: '百眼魔君', k: 'demon', t: '#a06bb0' }, { w: '毗蓝婆菩萨', k: 'god', t: '#9a6bb0' }],
      lines: [
        { w: '蜈蚣精', t: '我的金光，你进不得身！', a: 'cast' },
        { w: 'wukong', t: '千只眼放光，焠得俺头疼！', a: 'cry' },
        { w: '毗蓝婆', t: '我这绣花针，破他金光。', a: 'descend' },
        { w: '毗蓝婆', t: '蜈蚣精，去看守门户。', a: 'bow' } ] },
    /* 30 狮驼岭 */ { set: 'mountain', cast: ['tang', { w: 'wukong' }, { w: '青狮精', k: 'demon', t: '#d9b24a' }, { w: '白象精', k: 'demon', t: '#cfd2d6' }, { w: '大鹏雕', k: 'demon', t: '#e0b94a' }, { w: '如来佛祖', k: 'god', t: '#e0b94a' }],
      lines: [
        { w: '大鹏', t: '三魔同心，这唐僧肉我等分了！', a: 'laugh' },
        { w: 'wukong', t: '阴阳二气瓶，险些蒸了俺老孙！', a: 'cry' },
        { w: '如来', t: '悟空莫慌，这大鹏我自来收。', a: 'descend' },
        { w: '如来', t: '文殊普贤各收坐骑，大鹏随我回灵山。', a: 'bow' } ] },
    /* 31 比丘国 */ { set: 'palace', cast: ['tang', { w: 'wukong' }, { w: '白鹿精', k: 'demon', t: '#e8e6df' }, { w: '南极寿星', k: 'god', t: '#e8e6df' }],
      lines: [
        { w: '白鹿', t: '一千一百一十一个小儿心肝，作药引！', a: 'laugh' },
        { w: 'wukong', t: '城隍土地，摄走群儿，莫害童男童女！', a: 'warn' },
        { w: '寿星', t: '鹿儿，还不现形！', a: 'descend' },
        { w: '寿星', t: '悟空，还我白鹿去。', a: 'bow' } ] },
    /* 32 无底洞 */ { set: 'cave', cast: ['tang', { w: 'wukong' }, { w: '金鼻白毛鼠', k: 'demon', t: '#cfd2d6' }, { w: '托塔李天王', k: 'god', t: '#d9b24a' }, { w: '哪吒三太子', k: 'god', t: '#d65a4a' }],
      lines: [
        { w: '老鼠精', t: '唐僧哥哥，与我做夫妻可好？', a: 'laugh' },
        { w: 'wukong', t: '这妖供着父王李天王牌位，待我上天告状！', a: 'warn' },
        { w: '李天王', t: '孽畜，原是灵山偷灯油的鼠！', a: 'descend' },
        { w: '哪吒', t: '缚妖索捆了，随父回天。', a: 'bow' } ] },
    /* 33 灭法国 */ { set: 'capital', cast: ['tang', { w: 'wukong' }, { w: '灭法国王', k: 'folk' }],
      lines: [
        { w: '灭法国王', t: '朕要杀一万和尚，已杀九千九百九十六！', a: 'boast' },
        { w: 'wukong', t: '待我夜入皇城，把尔等尽数剃光！', a: 'warn' },
        { w: '灭法国王', t: '哎呀，朕与百官怎地都成了和尚？', a: 'fear' },
        { w: 'wukong', t: '从此改国号钦法国，送我师徒西去。', a: 'bow' } ] },
    /* 34 隐雾山 */ { set: 'cave', cast: ['tang', { w: 'bajie' }, { w: '南山大王', k: 'demon', t: '#9a7a4a' }, { w: 'wukong' }],
      lines: [
        { w: '豹子精', t: '分瓣梅花计，调开三徒擒唐僧！', a: 'laugh' },
        { w: 'bajie', t: '妖怪，俺老猪一钯！', a: 'swing' },
        { w: 'wukong', t: '假人头诓我，吃俺一棒！', a: 'swing' } ] },
    /* 35 凤仙郡 */ { set: 'capital', cast: ['tang', { w: 'wukong' }, { w: '凤仙郡侯', k: 'folk' }, { w: '玉皇大帝', k: 'god', t: '#d9b24a' }],
      lines: [
        { w: '郡侯', t: '三载亢旱，民不聊生，求大圣降雨！', a: 'fear' },
        { w: 'wukong', t: '玉帝立米山面山，须郡侯行善方雨。', a: 'warn' },
        { w: '玉帝', t: '郡侯焚香拜天，三事顿消，准你下雨。', a: 'bow' } ] },
    /* 36 玉华州 */ { set: 'city', cast: ['tang', { w: 'wukong' }, { w: '九灵元圣', k: 'demon', t: '#d9b24a' }, { w: '太乙救苦天尊', k: 'god', t: '#6fae8c' }],
      lines: [
        { w: '九头狮', t: '一口衔了你师徒去！', a: 'laugh' },
        { w: 'wukong', t: '这老妖一口擒三徒，厉害！', a: 'cry' },
        { w: '天尊', t: '元圣儿，还不归槽！', a: 'descend' },
        { w: '天尊', t: '悟空，领我狮奴喝破他。', a: 'bow' } ] },
    /* 37 金平府 */ { set: 'temple', cast: ['tang', { w: 'wukong' }, { w: '辟寒大王', k: 'demon', t: '#9aa0a6' }, { w: '四木禽星', k: 'god', t: '#6f9a5a' }],
      lines: [
        { w: '辟寒', t: '元宵金灯香油，好受用！', a: 'laugh' },
        { w: 'wukong', t: '假佛摄我师父，吃俺一棒！', a: 'swing' },
        { w: '四木禽星', t: '犀牛畏我木禽，随我上天！', a: 'descend' },
        { w: '四木禽星', t: '锯角献佛，免了地方供油。', a: 'bow' } ] },
    /* 38 天竺国 */ { set: 'palace', cast: ['tang', { w: 'wukong' }, { w: '玉兔精', k: 'demon', t: '#e8e6df' }, { w: '太阴星君', k: 'god', t: '#cfd6e0' }, { w: '嫦娥', k: 'god', t: '#e8e6df' }],
      lines: [
        { w: '玉兔', t: '抛绣球招亲，正中唐僧！', a: 'laugh' },
        { w: 'wukong', t: '妖气！待我追出捣药玉杵。', a: 'warn' },
        { w: '太阴星君', t: '玉兔思凡，随我回广寒宫。', a: 'descend' },
        { w: '嫦娥', t: '素娥一掌之仇，今已解了。', a: 'bow' } ] },
    /* 39 铜台府 */ { set: 'city', cast: ['tang', { w: 'wukong' }, { w: '寇员外', k: 'folk' }, { w: '强盗', k: 'folk' }, { w: '地藏王菩萨', k: 'god', t: '#e0b94a' }],
      lines: [
        { w: '寇员外', t: '斋僧圆满，留长老盘桓半月。', a: 'think' },
        { w: '强盗', t: '劫了财物，踢死员外，赖和尚！', a: 'laugh' },
        { w: 'wukong', t: '变蜢虫陈情，又赴地府讨寿。', a: 'warn' },
        { w: '地藏', t: '寇洪还魂，冤案得雪。', a: 'bow' } ] },
    /* 40 凌云渡 */ { set: 'river', cast: ['tang', { w: 'wukong' }, { w: '白龙马', k: 'bailong' }, { w: '接引佛祖', k: 'god', t: '#e0b94a' }],
      lines: [
        { w: '接引', t: '这独木桥不行，我撑无底船来渡你。', a: 'descend' },
        { w: 'tang', t: '上游漂下一具死尸，好怕人！', a: 'fear' },
        { w: 'wukong', t: '师父莫怕，那个原来是你！', a: 'laugh' },
        { w: '接引', t: '脱了凡胎，方得上灵山。', a: 'bow' } ] },
    /* 41 大雷音寺 */ { set: 'sky', cast: ['tang', { w: 'wukong' }, { w: 'bajie' }, { w: 'shaseng' }, { w: '如来佛祖', k: 'god', t: '#e0b94a' }, { w: '阿傩伽叶', k: 'folk' }, { w: '观音菩萨', k: 'god', t: '#3c9d6e' }],
      lines: [
        { w: '如来', t: '唐僧师徒，功行已满，来取真经。', a: 'descend' },
        { w: '阿傩', t: '略备人事，方可传经。', a: 'think' },
        { w: 'tang', t: '贫僧并无财物……', a: 'fear' },
        { w: '观音', t: '还少一难，再添通天河一难方足九九。', a: 'warn' } ] }
  ];

  /* -------------------------------------------------------------------
   * 第九十九回「灾难的簿子」逐难名录（简体，依维基文库校本）
   * at = 该难归属的站点索引；prelude = 唐僧前尘（出发前已历）；
   * 第 81 难难簿未列，系观音补足，见第九十九回正文。
   * ----------------------------------------------------------------- */
  var CALAMITY_NAMES = [
    '金蝉遭贬', '出胎几杀', '满月抛江', '寻亲报冤', '出城逢虎', '折从落坑', '双叉岭上', '两界山头',
    '陡涧换马', '夜被火烧', '失却袈裟', '收降八戒', '黄风怪阻', '请求灵吉', '流沙难渡', '收得沙僧',
    '四圣显化', '五庄观中', '难活人参', '贬退心猿', '黑松林失散', '宝象国捎书', '金銮殿变虎', '平顶山逢魔',
    '莲花洞高悬', '乌鸡国救主', '被魔化身', '号山逢怪', '风摄圣僧', '心猿遭害', '请圣降妖', '黑河沉没',
    '搬运车迟', '大赌输赢', '祛道兴僧', '路逢大水', '身落天河', '鱼篮现身', '金兜山遇怪', '普天神难伏',
    '问佛根源', '吃水遭毒', '西梁国留婚', '琵琶洞受苦', '再贬心猿', '难辨猕猴', '路阻火焰山', '求取芭蕉扇',
    '收缚魔王', '赛城扫塔', '取宝救僧', '棘林吟咏', '小雷音遇难', '诸天神遭困', '稀柿衕秽阻', '朱紫国行医',
    '拯救疲癃', '降妖取后', '七情迷没', '多目遭伤', '路阻狮驼', '怪分三色', '城里遇灾', '请佛收魔',
    '比丘救子', '辨认真邪', '松林救怪', '僧房卧病', '无底洞遭困', '灭法国难行', '隐雾山遇魔', '凤仙郡求雨',
    '失落兵器', '会庆钉钯', '竹节山遭难', '玄英洞受苦', '赶捉犀牛', '天竺招婚', '铜台府监禁', '凌云渡脱胎',
    '通天河落水'
  ];
  /** 每 80 条难簿名对应的站点索引；第 81 难附于灵山（归途） */
  var CALAMITY_AT = [
    0, 0, 0, 0, 1, 1, 1, 2, 3, 4, 4, 5, 6, 6, 7, 7,
    8, 9, 9, 10, 11, 11, 11, 12, 12, 13, 13, 14, 14, 14, 14, 15,
    16, 16, 16, 17, 17, 17, 18, 18, 18, 19, 19, 20, 21, 21, 22, 22,
    22, 23, 23, 24, 25, 25, 26, 27, 27, 27, 28, 29, 30, 30, 30, 30,
    31, 31, 32, 32, 32, 33, 34, 35, 36, 36, 36, 37, 37, 38, 39, 40,
    41
  ];
  var CALAMITIES = CALAMITY_NAMES.map(function (name, i) {
    var c = { n: i + 1, name: name, at: CALAMITY_AT[i] };
    if (i < 4) c.prelude = true;
    if (i === 80) c.note = '难簿止于第八十难，观音查簿「还少一难」，命揭谛赶上金刚追加；归途老白鼋问寿不答，淬水湿经、晒经石留痕。';
    if (i === 5) c.alt = '一作「落坑折从」';
    return c;
  });

  /* -------------------------------------------------------------------
   * 神仙谱系：从各站 helpers 自动聚合，形成「神仙 → 所有出手地点」反查。
   * 同名归一：去括号注、拆「/」并列；HELPER_META 补称号与出处。
   * ----------------------------------------------------------------- */
  var HELPER_META = {
    '观世音菩萨':   { title: '南海落伽山 · 救苦救难', desc: '全书出手最多者，凡紧箍、甘露、鱼篮、莲台、善财童子诸事皆由其了结。' },
    '观音菩萨':     { title: '南海落伽山 · 观世音菩萨异称', desc: '与「观世音菩萨」同指，此处为站内的简写。' },
    '如来佛祖':     { title: '西天灵山 · 释迦牟尼', desc: '辨六耳猕猴、指青牛根源、亲降狮驼三魔，并授真经。' },
    '太上老君':     { title: '兜率宫 · 道祖', desc: '收金炉银炉二童子、青牛精，并赐乌鸡国还魂丹。' },
    '玉皇大帝':     { title: '天庭 · 凌霄宝殿', desc: '查奎木狼私凡，立凤仙郡米山面山之誓。' },
    '太白金星':     { title: '天庭 · 西方长庚', desc: '双叉岭解厄、黄风岭指路、狮驼岭报信，三次现身。' },
    '昴日星官':     { title: '光明宫 · 双冠子大公鸡', desc: '两声啼鸣伏蝎子精；其目中所炼绣花针又助毗蓝婆破百眼魔君。' },
    '文殊菩萨':     { title: '五台山 · 大智', desc: '收乌鸡国青毛狮子与狮驼岭青狮，并参与四圣试禅心。' },
    '普贤菩萨':     { title: '峨眉山 · 大行', desc: '收狮驼岭白象，并参与四圣试禅心。' },
    '弥勒佛':       { title: '东来佛祖 · 兜率院', desc: '以熟瓜之计收伏司磬黄眉童儿。' },
    '灵吉菩萨':     { title: '小须弥山', desc: '定风丹与飞龙宝杖，两度相助（黄风怪、火焰山）。' },
    '毗蓝婆菩萨':   { title: '紫云山千花洞', desc: '昴日星官之母，以绣花针破百眼魔君金光。' },
    '太乙救苦天尊': { title: '东极妙岩宫', desc: '九灵元圣之主，喝破九头狮子归天。' },
    '托塔李天王':   { title: '天庭 · 降魔大元帅', desc: '火焰山围剿牛魔王、无底洞收义女鼠精。' },
    '哪吒三太子':   { title: '天庭 · 三坛海会大神', desc: '随父降牛魔王与地涌夫人，曾失兵器于金刚琢。' },
    '二郎显圣真君': { title: '灌江口 · 梅山兄弟', desc: '碧波潭合剿九头虫。' },
    '南极寿星':     { title: '南极仙翁', desc: '比丘国收白鹿精，救一千一百一十一个小儿。' },
    '太阴星君':     { title: '广寒宫', desc: '偕嫦娥收伏假冒公主的玉兔精。' },
    '地藏王菩萨':   { title: '幽冥教主', desc: '谛听识破六耳猕猴而不敢言；亦为寇洪延寿一纪。' },
    '黎山老母':     { title: '骊山老母', desc: '四圣试禅心之首，亦指点悟空请毗蓝婆。' },
    '接引佛祖':     { title: '灵山 · 南无宝幢光王佛', desc: '撑无底船渡凌云渡，唐僧由此脱去凡胎。' },
    '孙悟空':       { title: '齐天大圣 · 自行降妖', desc: '多数劫难不假外求，识破白骨、六耳、木仙诸妖皆靠火眼金睛。' },
    '镇元大仙':     { title: '万寿山 · 地仙之祖', desc: '袖里乾坤擒四众，后与悟空结为兄弟。' }
  };

  /** 同一神仙的异称合并，避免谱系里出现两条「观音」 */
  var HELPER_ALIASES = {
    '观音菩萨': '观世音菩萨', '观音大士': '观世音菩萨', '南海观音': '观世音菩萨',
    '李天王': '托塔李天王', '哪吒': '哪吒三太子', '寿星': '南极寿星',
    '东来佛祖': '弥勒佛', '太阴星君': '太阴星君'
  };
  function normalizeHelper(name) {
    var n = String(name).replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
    return HELPER_ALIASES[n] || n;
  }
  function expandHelpers(list) {
    var out = [];
    (list || []).forEach(function (h) {
      // 并列写法：「/」「／」「、」「及」都拆成独立神仙
      String(h.name).split(/\s*[／/、]\s*|\s*及\s*/).forEach(function (part) {
        var n = normalizeHelper(part);
        if (n) out.push({ name: n, side: h.side });
      });
    });
    return out;
  }

  var HELPERS = [];
  var HELPER_BY_NAME = {};
  var INDEX = { demons: {}, chapters: {} };

  /* 唯一一次派生：补齐 index / era / 累计难数 / 本站难目 / 神仙归一等字段 */
  var acc = 0, cursor = 0;
  WAYPOINTS.forEach(function (p, i) {
    p.index = i;
    p.era = eraOf(p.year);
    p.isDemonLair = p.demons.length > 0 && (p.type === 'cave' || p.type === 'demon');
    p.aidLabel = p.aid ? ANCHORS[p.aid].short : '';
    p.helperNames = p.helpers.map(function (h) { return normalizeHelper(h.name); });
    p.canonicalHelpers = expandHelpers(p.helpers);
    p.scene = (typeof SCENES !== 'undefined' && SCENES[i]) ? SCENES[i] : null;

    // 本站包含的难目与累计难数（严格依第九十九回难簿）
    p.calamityList = [];
    while (cursor < CALAMITIES.length && CALAMITIES[cursor].at === i) {
      p.calamityList.push(CALAMITIES[cursor]);
      acc = CALAMITIES[cursor].n;
      cursor++;
    }
    p.calamity = acc;

    // 神仙谱系与反向索引
    p.canonicalHelpers.forEach(function (h) {
      if (!HELPER_BY_NAME[h.name]) {
        var rec = { name: h.name, side: h.side, places: [], meta: HELPER_META[h.name] || null };
        HELPER_BY_NAME[h.name] = rec;
        HELPERS.push(rec);
      }
      if (HELPER_BY_NAME[h.name].places.indexOf(i) < 0) HELPER_BY_NAME[h.name].places.push(i);
    });
    p.demons.forEach(function (d) {
      var k = normalizeHelper(d);
      if (!INDEX.demons[k]) INDEX.demons[k] = [];
      if (INDEX.demons[k].indexOf(i) < 0) INDEX.demons[k].push(i);
    });
    for (var ch = p.chapters[0]; ch <= p.chapters[1]; ch++) {
      if (!INDEX.chapters[ch]) INDEX.chapters[ch] = [];
      INDEX.chapters[ch].push(i);
    }
  });
  HELPERS.forEach(function (h) { h.count = h.places.length; });
  HELPERS.sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name, 'zh'); });
  META.stationCount = WAYPOINTS.length;
  META.helperCount = HELPERS.length;

  /* -------------------------------------------------------------------
   * 叙事视觉数据（仍属数据层：渲染层只按 id / 索引取用，不写死原著内容）
   * ----------------------------------------------------------------- */

  /**
   * 三大地理色区。x 为长卷用户坐标，自右（东 / 长安）向左（西 / 灵山）递减；
   * x1 > x0。边界取「两界山—流沙河」「比丘国—天竺」之间的自然地理转折，
   * 属长卷构图的叙事分区，并非真实测绘图幅。
   */
  var REGIONS = [
    { id: 'datang',  name: '东土大唐', sub: '关中 · 河西',   x0: 1240, x1: 1600, tone: 'jade',  note: '唐王御弟，奉旨出关' },
    { id: 'xiyu',    name: '西域诸国', sub: '流沙 · 火焰 · 狮驼', x0: 430, x1: 1240, tone: 'ochre', note: '八十一难多在此间' },
    { id: 'tianzhu', name: '天竺佛境', sub: '灵山在望',     x0: 0,    x1: 430,  tone: 'gold',  note: '去灵山不过一箭之地' }
  ];

  /**
   * 氛围段：行程落于 [from, to] 时切换地望气候，段间不重叠。
   * tone 对应渲染层的配色与局部特效，verse 为氛围出处提示。
   */
  var MOODS = [
    { id: 'ice',     from: 17, to: 17, tone: 'ice',     title: '通天河 · 冰封八百里', sub: '径过八百里，亘古少行人', verse: '第四十七回' },
    { id: 'blossom', from: 19, to: 20, tone: 'blossom', title: '西梁女国 · 春暖人烟', sub: '法性西来逢女国',       verse: '第五十四回' },
    { id: 'fire',    from: 22, to: 23, tone: 'fire',    title: '火焰山 · 八百里烈焰', sub: '火光大地有声名',       verse: '第五十九～六十一回' },
    { id: 'dark',    from: 29, to: 31, tone: 'dark',    title: '狮驼岭 · 尸山妖氛',   sub: '四万八千小妖，专在此吃人', verse: '第七十四～七十七回' },
    { id: 'holy',    from: 40, to: 41, tone: 'holy',    title: '灵山 · 佛光普照',     sub: '九九归真，五圣成真',   verse: '第九十八～一百回' }
  ];

  /**
   * 重点劫难原著引文。全部依百回本原文（维基文库 / 识典古籍校本）录入，
   * 简体转写并保留原句；source 注明回目与语境，便于课堂引用。
   */
  var QUOTES = [
    { at: 0,  tag: '奉旨西行', source: '第十三回 · 开篇诗',
      text: '自今别驾投西去，秉教迦持悟大空。' },
    { at: 1,  tag: '魔由心生', source: '第十三回 · 三藏答法门寺众僧',
      text: '心生，种种魔生；心灭，种种魔灭。' },
    { at: 2,  tag: '心猿归正', source: '第十三回 · 回末',
      text: '我师父来也！我师父来也！' },
    { at: 10, tag: '贬书逐徒', source: '第二十七回 · 唐僧贬书',
      text: '猴头，执此为照，再不要你做徒弟了；如再与你相见，我就堕了阿鼻地狱。' },
    { at: 17, tag: '夜阻通天水', source: '第四十七回 · 咏通天河',
      text: '洋洋光浸月，浩浩影浮天。灵派吞华岳，长流贯百川。' },
    { at: 22, tag: '三调芭蕉扇', source: '第六十一回 · 火焰山诗（有诗为证）',
      text: '火焰山遥八百程，火光大地有声名。火煎五漏丹难熟，火燎三关道不清。' },
    { at: 30, tag: '长庚报信', source: '第七十四回 · 太白金星化身老者',
      text: '此山叫做八百里狮驼岭，中间有座狮驼洞，洞里有三个魔头。' },
    { at: 40, tag: '九九归真', source: '第九十九回 · 观音查难簿',
      text: '九九归真道行难，坚持笃志立玄关。必须苦练邪魔退，定要修持正法还。' }
  ];

  var QUOTE_BY_AT = {};
  QUOTES.forEach(function (q) { QUOTE_BY_AT[q.at] = q; });

  function regionAt(x) {
    for (var i = 0; i < REGIONS.length; i++) {
      if (x >= REGIONS[i].x0 && x < REGIONS[i].x1) return REGIONS[i];
    }
    return x >= REGIONS[REGIONS.length - 1].x1
      ? REGIONS[0] : REGIONS[REGIONS.length - 1];
  }
  function moodAt(i) {
    for (var j = 0; j < MOODS.length; j++) {
      if (i >= MOODS[j].from && i <= MOODS[j].to) return MOODS[j];
    }
    return null;
  }
  function quoteAt(i) { return QUOTE_BY_AT[i] || null; }

  /** 回目解析：支持「59」「第五十九回」「一百回」等写法 */
  function chapterNo(q) {
    var d = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    var digits = q.match(/^\d{1,3}$/);
    if (digits) return +digits[0];
    var m = q.match(/^第?([零一二三四五六七八九十百]+)回?$/);
    if (!m) return null;
    var t = m[1];
    if (t.indexOf('百') >= 0) return 100;
    if (t.indexOf('十') >= 0) {
      var ab = t.split('十');
      var tens = ab[0] === '' ? 1 : (d[ab[0]] || 0);
      var ones = ab[1] ? (d[ab[1]] || 0) : 0;
      return tens * 10 + ones;
    }
    return d[t] === undefined ? null : d[t];
  }

  /**
   * 纯数据检索（不含 DOM）：地点 / 神仙 / 妖魔 / 回目 / 难目 五路命中。
   * 返回索引数组，由渲染层决定如何展示。
   */
  function lookup(raw) {
    var q = String(raw || '').trim().toLowerCase();
    var out = { query: q, places: [], helpers: [], demons: [], chapters: [], calamities: [] };
    if (!q) return out;

    WAYPOINTS.forEach(function (p, i) {
      var hay = [p.name, p.sub, p.era, String(p.year), p.chapter, p.story]
        .concat(p.demons, p.helperNames).join(' ').toLowerCase();
      if (hay.indexOf(q) >= 0 && out.places.indexOf(i) < 0) out.places.push(i);
    });
    HELPERS.forEach(function (h) {
      var hay = h.name + ' ' + (h.meta ? h.meta.title + ' ' + h.meta.desc : '');
      if (hay.toLowerCase().indexOf(q) >= 0) out.helpers.push(h.name);
    });
    Object.keys(INDEX.demons).forEach(function (k) {
      if (k.toLowerCase().indexOf(q) >= 0) out.demons.push(k);
    });
    CALAMITIES.forEach(function (c) {
      if (c.name.toLowerCase().indexOf(q) >= 0 || String(c.n) === q) out.calamities.push(c.n);
    });
    var n = chapterNo(q);
    if (n && n >= 1 && n <= 100) {
      out.chapterNo = n;
      (INDEX.chapters[n] || []).forEach(function (i) {
        if (out.chapters.indexOf(i) < 0) out.chapters.push(i);
      });
    }
    return out;
  }

  /** 取某神仙的全部出手站点（供「神仙援助雷达」反查） */
  function helperPlaces(name) {
    var h = HELPER_BY_NAME[name];
    return h ? h.places.slice() : [];
  }
  function calamitiesAt(i) {
    return WAYPOINTS[i] ? WAYPOINTS[i].calamityList.slice() : [];
  }

  global.XIYOU_DATA = {
    META: META,
    TEAM: TEAM,
    ANCHORS: ANCHORS,
    WAYPOINTS: WAYPOINTS,
    CALAMITIES: CALAMITIES,
    HELPERS: HELPERS,
    INDEX: INDEX,
    REGIONS: REGIONS,
    MOODS: MOODS,
    QUOTES: QUOTES,
    eraOf: eraOf,
    lookup: lookup,
    helperPlaces: helperPlaces,
    calamitiesAt: calamitiesAt,
    regionAt: regionAt,
    moodAt: moodAt,
    quoteAt: quoteAt
  };
})(window);
