// English word lists for the structure scores. Any change here changes the score: bump the version in rules.js (a test enforces it).
export const EN = Object.freeze({
  stop: ['the','a','an','and','or','but','if','then','so','of','to','in','on','at','by','for','with','from','as','is','are','was','were','be','been','being','it','its','this','that','these','those','i','you','he','she','we','they','me','my','our','your','their','his','her','them','us','do','did','does','have','has','had','will','would','can','could','should','may','might','not','no','yes','than','too','very','also','just','about','into','over','after','before','while','when','what','which','who','how','why','there','here','up','down','out','all','any','some','more','most','other','such','only','own','same','each','both'],
  firstSingular: ['i','my','me','myself','mine'],
  team: ['we','our','ours','us','ourselves','the team','as a team','together with'],
  vague: ['stuff','things','thing','somehow','various','basically','a lot','lots of','helped','tried','worked on','dealt with','involved in','assisted with','etc','and so on','whatever','good','nice','great'],
  hedge: ['maybe','perhaps','i guess','i think','i suppose','kind of','sort of','you know','probably','honestly','actually'],
  filler: ['um','uh','er','erm','hm','hmm','ah'],
  starCues: {
    situation: ['when','while','during','at the time','back then','last year','last month','faced','was working','were working'],
    task: ['responsible for','my role','my goal','the goal','goal was','needed to','had to','tasked','objective','assigned','my job','my responsibility','asked to'],
    result: ['as a result','result was','resulted in','outcome','led to','reduced','increased','improved','saved','grew','delivered','achieved','launched','so that'],
  },
  actionPattern: /\b(?:i|we)\s+(?:\w+ed|built|led|wrote|made|ran|set|took|did|chose|drove|brought|found|held|kept|sent|won)\b/,
  context: {
    place: ['company','startup','client','customer','project','department','team','organization','organisation','store','school','hospital','bank','agency'],
    time: ['last year','last month','last quarter','weeks ago','months ago','years ago','this year'],
    monthNames: ['january','february','march','april','may','june','july','august','september','october','november','december'],
  },
  responsibility: ['responsible for','my role','my goal','the goal','goal was','needed to','had to','tasked','objective','assigned','my job','my responsibility','asked to','was supposed to'],
});
