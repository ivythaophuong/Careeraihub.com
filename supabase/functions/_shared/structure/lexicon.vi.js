// Vietnamese word lists for the structure scores (diacritics kept: text is not stripped of accents). Any change here changes the score:
// bump the version in rules.js (a test enforces it).
export const VI = Object.freeze({
  stop: ['và','là','của','có','không','được','cho','này','một','những','các','khi','để','trong','với','đã','sẽ','tôi','bạn','như','thì','mà','ở','từ','ra','vào','lên','rất','cũng','gì','về','nên','nếu','vì','tại','bằng','đó','đây','họ','chúng','người','sau','trước','còn','hay','lại','nhưng','cả','theo','đến','bị','cần','phải','vẫn','đang','mình','sao','nào','thế','vậy','rồi','chỉ','hơn','nhất','mới','đều','bởi'],
  firstSingular: ['tôi','mình'],
  team: ['chúng tôi','chúng ta','chúng mình','chúng em','nhóm','đội','cả nhóm','cả đội','cùng nhau'],
  vague: ['nhiều thứ','mọi thứ','đủ thứ','linh tinh','vân vân','vv','giúp đỡ','hỗ trợ','cố gắng','thử','tham gia','liên quan','khá tốt','khá ổn','hơi','một số việc','nhiều việc','mọi việc'],
  hedge: ['chắc là','hình như','có lẽ','kiểu như','không biết nữa','tôi nghĩ là','thì là','nói chung là','nói chung','thực ra','thật ra'],
  filler: ['ờ','ừm','ừ','ơ','à','ừ thì','ơ thì','ờm','hừm'],
  starCues: {
    situation: ['khi','lúc','trong khi','tại thời điểm','hồi đó','năm ngoái','tháng trước','gặp phải','đối mặt'],
    task: ['nhiệm vụ','phụ trách','chịu trách nhiệm','mục tiêu','cần phải','được giao','vai trò của tôi','trách nhiệm của tôi'],
    result: ['kết quả','nhờ đó','nhờ vậy','giúp','giảm','tăng','cải thiện','tiết kiệm','đạt được','đạt','hoàn thành','dẫn đến'],
  },
  actionVerbs: ['đã','quyết định','triển khai','xây dựng','thiết kế','phân tích','đề xuất','thực hiện','phối hợp','lên kế hoạch','tổ chức','viết','dẫn dắt','tạo','cải tiến','đàm phán','kiểm tra','tự động hóa'],
  actors: ['tôi','mình','chúng tôi','nhóm','đội'],
  context: {
    place: ['công ty','dự án','khách hàng','phòng','bộ phận','nhóm','đội','trường','bệnh viện','ngân hàng','cửa hàng','tổ chức','doanh nghiệp'],
    time: ['năm ngoái','tháng trước','quý trước','năm nay','vài tháng','vài tuần','vài năm'],
    monthNames: [],
  },
  responsibility: ['nhiệm vụ','phụ trách','chịu trách nhiệm','mục tiêu','cần phải','được giao','vai trò của tôi','trách nhiệm của tôi','tôi được yêu cầu','được yêu cầu'],
});
