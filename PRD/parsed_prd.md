Product  Requirements  Document  (PRD)  –  
RidesRus
 
 
1.  Overview  
RidesRus  is  a  smart  bus-hailing  platform  designed  for  Lagos  commuters.  The  platform  allows  
passengers
 
to
 
see
 
available
 
buses
 
in
 
real
 
time,
 
hail
 
specific
 
buses,
 
board
 
securely
 
via
 
QR
 
code,
 
pay
 
seamlessly,
 
and
 
select
 
their
 
drop-off
 
stops.
 
Drivers
 
use
 
a
 
mounted
 
tablet
 
console
 
for
 
passenger
 
management
 
and
 
trip
 
coordination.
 
The  system  aims  to  modernize  intra-city  bus  transportation  by  combining  the  efficiency  of  
ride-hailing
 
with
 
the
 
scalability
 
of
 
bus
 
systems.
 
 
2.  Objectives  /  Goals  
●  Provide  real-time  bus  visibility  with  seat  availability.  
 ●  Enable  secure,  cashless  boarding  via  QR  code.  
 ●  Simplify  driver  operations  with  a  console  dashboard  (instead  of  phone  apps).  
 ●  Ensure  automated  passenger  flow  from  hail  →  boarding  →  stop  →  completion.  
 ●  Collect  valuable  usage  analytics  for  route  optimization  and  business  decisions.  
 
 
3.  Key  Assumptions  
●  Passengers  will  have  smartphones  with  internet  access.  
 ●  Each  bus  will  have  a  mounted  Android  tablet  with  internet  +  GPS.  
 ●  Payment  processing  will  rely  on  Paystack/Quickteller/Flutterwave  (local  gateways).  
 
●  GPS  accuracy  in  Lagos  may  vary  but  will  be  acceptable  with  adjustments.  
 ●  Initial  rollout:  6  buses  between  CMS  and  Adesanya .  
 
 
4.  Core  Features  &  Requirements   
Feature  1:  Live  Bus  Tracking  &  Seat  Availability  
Description :  Passengers  view  buses  on  a  map,  color-coded  by  seat  availability  (white  =  empty,  
green
 
=
 
seats
 
available,
 
red
 
=
 
full).
 
●  Functional  Requirement :  GPS  tracking  for  each  bus,  seat  count  synced  to  server.  
 ●  User  Stories :  
 1.  As  a  passenger,  I  want  to  see  buses  near  me  so  I  know  which  one  to  board.  
 2.  As  a  passenger,  I  want  to  know  if  there  are  free  seats  before  hailing.  
 3.  As  an  admin,  I  want  to  track  buses  to  monitor  service  coverage.  
 ●  Success  Metrics :  90%+  of  passengers  use  map  to  find  buses  daily.  
 
 
Feature  2:  Hailing  a  Bus  
Description :  Passenger  taps  a  bus  →  pop-up  →  hail  option  →  driver  console  alerted.  
●  Functional  Requirement :  Pop-up  UI,  hail  request  API,  bus  console  notifications.  
 ●  User  Stories :  
 1.  As  a  passenger,  I  want  to  hail  a  bus  so  the  driver  knows  to  stop  for  me.  
 2.  As  a  driver,  I  want  hail  notifications  so  I  don’t  miss  passengers.  
 3.  As  an  admin,  I  want  hail  logs  for  demand  analysis.  
 
●  Success  Metrics :  80%  of  hails  successfully  converted  into  boardings.  
 
 
Feature  3:  Boarding  via  QR  Code  
Description :  Boarding  only  happens  after  passenger  scans  QR.  This  confirms  hail,  processes  
payment,
 
and
 
updates
 
seat
 
count.
 
●  Functional  Requirement :  QR  code  generator  per  bus,  in-app  scanner,  payment  API.  
 ●  User  Stories :  
 1.  As  a  passenger,  I  want  to  scan  a  QR  to  confirm  my  booking  and  pay.  
 2.  As  a  driver,  I  want  boarding  to  update  automatically  without  manual  work.  
 3.  As  an  admin,  I  want  secure  QR  logs  to  prevent  fraud.  
 ●  Success  Metrics :  95%+  QR  scans  successful  on  first  try.  
 
 
Feature  4:  Stop  Selection  After  Boarding  
Description :  Once  seated,  passenger  selects  drop-off  stop.  If  app  is  closed,  push  notification  
prompts
 
them.
 
●  Functional  Requirement :  Stop  selection  UI,  push  notifications,  driver  console  sync.  
 ●  User  Stories :  
 1.  As  a  passenger,  I  want  to  select  my  stop  after  boarding  so  it’s  convenient.  
 2.  As  a  driver,  I  want  upcoming  stops  shown  so  I  don’t  miss  them.  
 3.  As  an  admin,  I  want  stop  data  for  route  optimization.  
 ●  Success  Metrics :  90%+  passengers  successfully  select  stops  before  drop-off.  
 
 
Feature  5:  Bus  Console  Dashboard  
Description :  Mounted  tablet  shows  driver  passenger  count,  seats  left,  upcoming  stops,  and  hail  
requests.
 
●  Functional  Requirement :  Tablet  app  with  large  fonts,  minimal  distractions,  offline  
fallback.
 
 ●  User  Stories :  
 1.  As  a  driver,  I  want  a  dashboard  so  I  can  easily  see  stops  and  passenger  count.  
 2.  As  a  passenger,  I  want  drivers  to  have  accurate  info  so  they  don’t  miss  me.  
 3.  As  an  admin,  I  want  dashboards  to  sync  live  for  monitoring  operations.  
 ●  Success  Metrics :  Drivers  report  <10%  missed  hails  due  to  dashboard  clarity.  
 
 
Feature  6:  Trip  Completion  &  Feedback  
Description :  At  drop-off,  passenger  sees  a  completion  screen  with  thank-you  message  +  
feedback
 
option.
 
●  Functional  Requirement :  End-of-trip  detection,  feedback  form,  analytics  storage.  
 ●  User  Stories :  
 1.  As  a  passenger,  I  want  a  trip  completion  message  so  I  know  my  trip  is  done.  
 2.  As  a  driver,  I  want  completed  trips  logged  for  accountability.  
 3.  As  an  admin,  I  want  feedback  to  measure  service  quality.  
 ●  Success  Metrics :  30%+  passengers  leave  feedback  after  trips.  
 
 
5.  SWOT  Analysis  (Overall  Product)  
●  Strengths :  
 ○  First-to-market  structured  bus-hailing  in  Lagos.  
 ○  Improves  commuter  trust  and  efficiency.  
 ○  Fully  digital,  less  cash  handling.  
 ●  Weaknesses :  
 ○  High  reliance  on  internet  and  GPS.  
 ○  Requires  passenger  smartphones  and  bus  tablets.  
 ○  Upfront  hardware  investment  for  buses.  
 ●  Opportunities :  
 ○  Expand  routes  across  Lagos  &  beyond.  
 ○  Introduce  corporate  subscriptions  (office  shuttles).  
 ○  Add  loyalty/rewards  system  for  frequent  riders.  
 ●  Threats :  
 ○  Competitors  (Uber  Bus,  SWVL-style  startups).  
 ○  Regulatory  pushback  on  new  transport  systems.  
 ○  Infrastructure  challenges  (poor  roads,  network  downtime).  
 
 
6.  Potential  Issues  /  Risks  
●  Tech  Risks :  GPS  inaccuracies,  payment  gateway  downtime,  app  crashes.  
 ●  Operational  Risks :  Drivers  ignoring  console,  passengers  not  scanning  QR.  
 ●  User  Risks :  Smartphone  penetration  &  adoption  barriers.  
 
●  Financial  Risks :  High  cost  of  scaling  with  hardware  (tablets,  mounts,  internet).  
 
 
7.  Success  Metrics  (KPIs)  
●  Adoption :  Number  of  active  passengers  per  day.  
 ●  Reliability :  %  of  successful  boardings  vs  hails.  
 ●  Revenue :  Total  fare  volume  processed  via  app.  
 ●  Efficiency :  Average  waiting  time  at  stops.  
 ●  Satisfaction :  Average  feedback  rating  per  trip.  
 