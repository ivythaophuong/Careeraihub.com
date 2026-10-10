// Synthetic fixtures only (no real person's text). English and Vietnamese are kept apart on purpose: each language has its own suite.
export const EN_STORIES = {
  strong: {
    situation: 'Last year our checkout page was slow during the November sales at the company and customers complained every day.',
    task: 'I was responsible for fixing the page load time before the campaign started.',
    action: 'I profiled the page, removed two blocking scripts, added caching and then I ran load tests with the team to confirm the fix.',
    result: 'Load time dropped by 40% and orders rose 12% in the first month, and complaints stopped.',
  },
  short: { situation: 'Site was slow.', task: 'Fix it now.', action: 'I fixed it.', result: 'It worked fine.' },
  padded: {
    situation: 'It was slow it was slow it was slow it was slow it was slow it was slow it was slow it was slow it was slow it was slow it was slow it was slow.',
    task: 'I had to fix it fix it fix it fix it fix it fix it fix it fix it fix it fix it fix it fix it fix it.',
    action: 'I did it I did it I did it I did it I did it I did it I did it I did it I did it I did it I did it I did it I did it I did it I did it.',
    result: 'It was fine it was fine it was fine it was fine it was fine it was fine it was fine it was fine it was fine.',
  },
  vague: {
    situation: 'There was some stuff going on with various things and it was basically a lot of things happening at work.',
    task: 'My job was to deal with stuff and things and help out somehow with whatever came up.',
    action: 'I tried to help with things, worked on various stuff and dealt with a lot of things, and I was involved in many things etc.',
    result: 'Things got better and it was good and nice, basically great, and everyone liked the stuff.',
  },
  quantifiedIrrelevant: {
    situation: 'The weather was nice and I like coffee, which costs 3 dollars at 2 different shops near my house.',
    task: 'I wanted to learn about 5 kinds of tea and 12 kinds of cake because it sounded interesting to me.',
    action: 'I walked 3 blocks and bought 4 items and counted 100 steps while thinking about the number 7.',
    result: 'I spent 25 dollars and walked 400 meters and that was 100% of my plan.',
  },
  teamOnly: {
    situation: 'Last year our company had to move the billing system while customers kept paying every day.',
    task: 'Our goal was to move the system without downtime before the end of the quarter.',
    action: 'We split the work, we tested every release and we agreed the plan together as a team with the finance group.',
    result: 'We finished without downtime and we saved 15 hours of manual work each week.',
  },
  incomplete: { situation: 'Last year our checkout page was slow during the November sales.', task: '', action: 'I profiled the page and removed two blocking scripts.', result: 'Load time dropped by 40%.' },
  notStar: {
    situation: 'I think teamwork is very important and people should communicate well with each other in every workplace.',
    task: 'Good leaders listen to others and respect different opinions, and I believe in honest feedback for everyone.',
    action: 'In my opinion a manager should always be fair and kind and I admire people who work hard every day.',
    result: 'That is why I value respect and trust above everything else when working with other people around me.',
  },
};

export const VI_STORIES = {
  strong: {
    situation: 'Năm ngoái, trang thanh toán của công ty tôi chạy rất chậm trong đợt khuyến mãi tháng 11 và khách hàng phàn nàn mỗi ngày.',
    task: 'Tôi chịu trách nhiệm giảm thời gian tải trang trước khi chiến dịch bắt đầu.',
    action: 'Tôi đã phân tích trang, gỡ hai đoạn mã gây chặn, thêm bộ nhớ đệm rồi tự chạy kiểm tra tải cùng nhóm để xác nhận kết quả.',
    result: 'Thời gian tải giảm 40% và số đơn hàng tăng 12% trong tháng đầu tiên, khách hàng không còn phàn nàn.',
  },
  short: { situation: 'Trang bị chậm.', task: 'Cần sửa gấp.', action: 'Tôi đã sửa.', result: 'Ổn rồi nhé.' },
  vague: {
    situation: 'Có nhiều thứ xảy ra ở chỗ làm và mọi thứ khá là linh tinh, đủ thứ việc cần làm vân vân.',
    task: 'Nhiệm vụ của tôi là giúp đỡ mọi việc và cố gắng làm nhiều thứ khi cần thiết ở công ty.',
    action: 'Tôi cố gắng hỗ trợ nhiều thứ, tham gia nhiều việc liên quan và hơi giúp đỡ mọi người vân vân.',
    result: 'Mọi thứ khá tốt và khá ổn, ai cũng thấy hơi hài lòng với nhiều việc đã làm.',
  },
  teamOnly: {
    situation: 'Năm ngoái công ty chúng tôi phải chuyển hệ thống thanh toán trong khi khách hàng vẫn thanh toán mỗi ngày.',
    task: 'Mục tiêu của nhóm là chuyển hệ thống mà không bị gián đoạn trước cuối quý.',
    action: 'Chúng tôi chia việc, chúng tôi kiểm tra từng bản phát hành và cả nhóm cùng thống nhất kế hoạch với phòng tài chính.',
    result: 'Chúng tôi hoàn thành không gián đoạn và tiết kiệm 15 giờ làm tay mỗi tuần.',
  },
  quantifiedIrrelevant: {
    situation: 'Hôm nay trời đẹp và tôi thích cà phê, một ly giá 30 nghìn ở 2 quán gần nhà tôi.',
    task: 'Tôi muốn tìm hiểu 5 loại trà và 12 loại bánh vì thấy nó khá thú vị với tôi.',
    action: 'Tôi đi bộ 3 dãy phố, mua 4 món và đếm 100 bước chân khi nghĩ về con số 7.',
    result: 'Tôi tiêu 250 nghìn đồng và đi 400 mét, đúng 100% kế hoạch của tôi.',
  },
  incomplete: { situation: 'Năm ngoái trang thanh toán của chúng tôi chạy chậm trong đợt khuyến mãi tháng 11.', task: '', action: 'Tôi đã phân tích trang và gỡ hai đoạn mã gây chặn.', result: 'Thời gian tải giảm 40%.' },
};

export const OTHER_LANGUAGE = {
  french: { situation: 'L année dernière notre site était très lent pendant les soldes et les clients se plaignaient.', task: 'Je devais corriger le temps de chargement avant le début de la campagne.', action: 'J ai analysé la page et j ai supprimé deux scripts bloquants avec toute l équipe.', result: 'Le temps de chargement a baissé de quarante pour cent le premier mois.' },
  chinese: { situation: '去年我们的结账页面在促销期间非常慢，客户每天都在抱怨。', task: '我负责在活动开始之前缩短页面加载时间。', action: '我分析了页面，删除了两个阻塞脚本，并和团队一起做了压力测试。', result: '加载时间下降了百分之四十，订单增长了百分之十二。' },
};

export const Q = 'Tell me about a time you led a project under pressure.';
export const QVI = 'Hãy kể về một lần bạn dẫn dắt dự án dưới áp lực.';

export const EN_ANSWERS = {
  strong: 'I led the checkout migration at Acme in 2023. When sales doubled in November, I split the work into three phases, and as a result we cut errors by 30% and finished two weeks early.',
  parrot: 'A time I led a project under pressure. Tell me about a time you led a project under pressure, a project under pressure.',
  shortRelevant: 'I led the Acme migration under pressure and cut errors by 30%.',
  noStarButRelevant: 'Leading a project under pressure means setting clear priorities. I use Jira and weekly reviews with Maria and everyone sees the same plan while the project stays on track.',
  fillerUm: 'Um, so, ummm, I guess I led a project, uh, kind of under pressure, you know, maybe it was um sort of a migration, I think, probably.',
  fillerUmmmm: 'Ummmm so uhhh I guess I led a project ummmmm kind of under pressure you know maybe a migration I think probably.',
  tiny: 'Yes I did.',
};
export const VI_ANSWERS = {
  strong: 'Tôi đã dẫn dắt việc chuyển hệ thống thanh toán tại Acme năm 2023. Khi doanh số tăng gấp đôi vào tháng 11, tôi chia việc thành ba giai đoạn, nhờ đó chúng tôi giảm 30% lỗi và hoàn thành sớm hai tuần.',
  codeSwitch: 'Tôi đã deploy hệ thống mới lên AWS trong vòng 2 tuần, và tôi dùng Jira để theo dõi các task của nhóm, nhờ đó giảm latency được 30%.',
  parrot: 'Một lần dẫn dắt dự án dưới áp lực. Hãy kể về một lần bạn dẫn dắt dự án dưới áp lực, dự án dưới áp lực.',
  filler: 'Ờ, ừm, thì là tôi dẫn dắt một dự án, kiểu như dưới áp lực, hình như là chuyển hệ thống, chắc là vậy, ờ, ừmmm.',
};
