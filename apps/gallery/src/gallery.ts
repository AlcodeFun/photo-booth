import { themeTokenCssVars, type BoothTheme } from '@photo-booth/types';

/** Kelana mark on a white tile (same as the booth favicon), inlined so the worker serves no extra file. */
const KELANA_FAVICON = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201200%201200%22%20role%3D%22img%22%20aria-label%3D%22Kelana%22%3E%3Crect%20width%3D%221200%22%20height%3D%221200%22%20rx%3D%22264%22%20fill%3D%22%23FFFFFF%22%2F%3E%3Cg%20transform%3D%22translate(81.7%20265.9)%20scale(0.8711)%22%3E%3Cpath%20fill%3D%22%23515543%22%20d%3D%22M%20281.5%20318.7%20C%20278.6%20319%2C%20256.3%20322.7%2C%20230.5%20327.1%20C%20223.9%20328.3%2C%20214.9%20329.6%2C%20210.5%20330.1%20C%20199.3%20331.4%2C%20191.6%20332.6%2C%20183.5%20334.4%20C%20179.7%20335.2%2C%20172.2%20336.4%2C%20167%20337%20C%20161.8%20337.6%2C%20153.3%20339%2C%20148.3%20340.1%20C%20143.2%20341.1%2C%20135.9%20342.4%2C%20132.1%20343%20C%20119.8%20344.7%2C%20117.2%20347.5%2C%20118.3%20357.3%20C%20119.3%20365.2%2C%20122.3%20367.5%2C%20131%20366.6%20C%20148.5%20364.8%2C%20188.6%20362%2C%20210%20361%20C%20220.2%20360.5%2C%20238.2%20359.2%2C%20250%20358%20C%20261.8%20356.9%2C%20275.3%20355.7%2C%20280%20355.4%20C%20295%20354.4%2C%20299.3%20351.6%2C%20306%20338.3%20C%20314%20322.7%2C%20305.3%20315.7%2C%20281.5%20318.7%20M%20236%20436.6%20C%20227.5%20437.3%2C%20209.7%20439.3%2C%20196.5%20440.9%20C%20183.3%20442.6%2C%20169.8%20444.2%2C%20166.5%20444.5%20C%20163.2%20444.9%2C%20156.5%20446%2C%20151.5%20447%20C%20146.6%20448%2C%20139.4%20449.1%2C%20135.5%20449.5%20C%20131.7%20449.9%2C%20123.8%20451.3%2C%20118%20452.6%20C%20112.2%20453.8%2C%20102.9%20455.6%2C%2097.2%20456.4%20C%2091.6%20457.3%2C%2084.4%20458.6%2C%2081.2%20459.4%20C%2078.1%20460.2%2C%2071.5%20461.4%2C%2066.5%20462%20C%2049.5%20464.1%2C%2043.6%20469.4%2C%2048.7%20478.1%20C%2051.8%20483.4%2C%2053.5%20483.6%2C%2083.9%20481.7%20C%2099.1%20480.7%2C%20115.9%20480%2C%20121.3%20480%20C%20126.7%20480%2C%20134.1%20479.6%2C%20137.8%20479%20C%20149.7%20477.3%2C%20180.9%20474.9%2C%20203.5%20474%20C%20215.6%20473.6%2C%20226.2%20472.9%2C%20227%20472.6%20C%20227.8%20472.3%2C%20236.2%20471.4%2C%20245.5%20470.5%20C%20265.8%20468.7%2C%20271.7%20467.2%2C%20277.2%20462.2%20C%20285.5%20454.7%2C%20285.3%20448.1%2C%20276.3%20441.3%20C%20269.1%20435.9%2C%20258.2%20434.6%2C%20236%20436.6%20M%20259.5%20551.6%20C%20256.2%20552.3%2C%20248.6%20553.7%2C%20242.5%20554.5%20C%20236.5%20555.4%2C%20225.9%20557.2%2C%20219%20558.6%20C%20212.1%20559.9%2C%20202.7%20561.5%2C%20198%20562.1%20C%20193.3%20562.6%2C%20184.1%20564.2%2C%20177.5%20565.5%20C%20170.9%20566.8%2C%20162.6%20568.1%2C%20159%20568.5%20C%20155.4%20568.9%2C%20149.1%20570%2C%20145%20571%20C%20140.9%20572.1%2C%20133.5%20573.4%2C%20128.5%20574%20C%20114.3%20575.7%2C%20111.2%20579.9%2C%20118.3%20587.6%20L%20121.6%20591.2%20135.6%20592.6%20C%20174.2%20596.3%2C%20213.6%20592.3%2C%20239.8%20581.9%20C%20265.9%20571.5%2C%20281.6%20556.1%2C%20270.5%20551.4%20C%20266.5%20549.8%2C%20267.2%20549.8%2C%20259.5%20551.6%22%2F%3E%3Cpath%20fill%3D%22%23537796%22%20fill-rule%3D%22evenodd%22%20d%3D%22M%20848%2037.7%20C%20766.2%2045.8%2C%20733.2%2068.9%2C%20671.9%20160.8%20C%20661.5%20176.3%2C%20652.2%20190.3%2C%20651.1%20191.8%20C%20640.6%20206.6%2C%20618.8%20241%2C%20617.9%20244.1%20C%20616.8%20247.6%2C%20616.9%20248.4%2C%20618.7%20250.8%20C%20621.3%20254.4%2C%20622.4%20254.7%2C%20658.5%20261.6%20C%20668.1%20263.5%2C%20688.8%20267.9%2C%20706%20271.7%20C%20725.8%20276.1%2C%20754.2%20275.8%2C%20768.5%20271.1%20C%20791.5%20263.4%2C%20798%20258.7%2C%20827.4%20228.1%20C%20847.8%20206.8%2C%20861.5%20191.3%2C%20870%20180%20C%20884.8%20160.3%2C%20897.7%20143.2%2C%20900.6%20139.5%20C%20916.3%20119%2C%20937.3%2088.7%2C%20940.2%2082.3%20C%20946.8%2067.3%2C%20943.4%2053.5%2C%20931.4%2046.8%20C%20922.3%2041.7%2C%20867.6%2035.7%2C%20848%2037.7%20M%20475.3%2074.1%20C%20468.6%2074.6%2C%20458.7%2075.9%2C%20453.3%2077%20C%20447.9%2078.2%2C%20440%2079.8%2C%20435.7%2080.6%20C%20397.7%2087.9%2C%20367.6%20108.9%2C%20353.9%20137.5%20C%20345.2%20155.6%2C%20342.2%20170.3%2C%20340%20204.5%20C%20339.4%20213.9%2C%20338.3%20227.1%2C%20337.5%20234%20C%20336.8%20240.9%2C%20335.9%20257.1%2C%20335.6%20270%20C%20335.1%20294.5%2C%20333.6%20321.1%2C%20331.9%20336.5%20C%20331.3%20341.5%2C%20330.5%20358.8%2C%20330%20375%20C%20329.6%20391.2%2C%20328.7%20413.7%2C%20328%20425%20C%20326%20460.2%2C%20327.1%20647.2%2C%20329.3%20657.8%20C%20336.7%20692.2%2C%20356.4%20712.2%2C%20388.9%20718.1%20C%20432.8%20726.1%2C%20509.7%20725.5%2C%20534.6%20717%20C%20550.9%20711.4%2C%20559.4%20700.5%2C%20562.1%20681.7%20C%20563.2%20673.6%2C%20561.8%20643.3%2C%20559.5%20626.5%20C%20558.7%20621%2C%20557.4%20609.1%2C%20556.5%20600%20C%20554.8%20581.9%2C%20550.7%20549.2%2C%20548.5%20536.3%20C%20545.6%20518.8%2C%20537.8%20508.6%2C%20518.5%20497.2%20C%20501.1%20487%2C%20489.4%20475.9%2C%20479.3%20460.4%20C%20464.3%20437.1%2C%20458.2%20397.6%2C%20464.8%20366.6%20C%20472.4%20331.2%2C%20491.1%20305%2C%20522%20286.5%20C%20531.1%20281%2C%20544%20268.3%2C%20547.2%20261.8%20C%20550%20256.1%2C%20553.1%20242.9%2C%20555%20229%20C%20555.7%20224.3%2C%20557.2%20215.8%2C%20558.5%20210%20C%20559.8%20204.2%2C%20561.6%20193.4%2C%20562.5%20186%20C%20563.4%20178.6%2C%20564.8%20169.6%2C%20565.5%20166%20C%20566.2%20162.4%2C%20567.1%20156.1%2C%20567.5%20152%20C%20567.8%20147.9%2C%20568.8%20139.4%2C%20569.7%20133.2%20C%20573.7%20103.8%2C%20567.7%2086.2%2C%20550.6%2078%20C%20541.2%2073.5%2C%20508.8%2071.8%2C%20475.3%2074.1%20M%20602%20282.9%20C%20569.2%20287.6%2C%20536.7%20310.7%2C%20522.3%20339.5%20C%20501%20381.9%2C%20511.1%20441.4%2C%20544.1%20468.8%20C%20557.2%20479.7%2C%20577%20490.1%2C%20590.1%20493%20C%20593.7%20493.8%2C%20601.1%20494.1%2C%20611.5%20493.8%20C%20629.3%20493.3%2C%20636.3%20491.4%2C%20654.5%20482.2%20C%20698.5%20460.1%2C%20720.9%20408.8%2C%20708.4%20359%20C%20697%20313.5%2C%20645.5%20276.7%2C%20602%20282.9%20M%20591.5%20315.5%20C%20564%20322.9%2C%20543%20347.4%2C%20543%20372.1%20C%20543%20388.1%2C%20552.8%20388.4%2C%20563.4%20372.6%20C%20573.4%20357.7%2C%20584.1%20349.5%2C%20602.4%20342.6%20C%20610.6%20339.5%2C%20613.7%20337.4%2C%20615.6%20333.9%20C%20621.9%20321.7%2C%20608%20311%2C%20591.5%20315.5%20M%20763.5%20460.1%20C%20748.8%20462%2C%20741.1%20465.4%2C%20700%20487.2%20C%20686%20494.6%2C%20665.1%20505.5%2C%20653.5%20511.4%20C%20614.7%20531.1%2C%20614.8%20530.9%2C%20630.4%20552.5%20C%20642.3%20569%2C%20653.4%20585.4%2C%20662%20599.1%20C%20674.9%20619.8%2C%20693%20646.6%2C%20699.6%20655%20C%20702.9%20659.1%2C%20707.1%20664.8%2C%20709%20667.5%20C%20720.8%20684.9%2C%20742%20704.7%2C%20760%20715.3%20C%20766.6%20719.1%2C%20784%20724.6%2C%20795.9%20726.6%20C%20820.2%20730.6%2C%20848.3%20724.9%2C%20877.8%20710.1%20C%20900.4%20698.8%2C%20927.8%20676.2%2C%20943.6%20656%20C%20946.8%20651.9%2C%20953.2%20644.3%2C%20957.7%20639.2%20C%20983.8%20609.7%2C%20987.2%20592.7%2C%20970.1%20576.7%20C%20965.3%20572.2%2C%20952.1%20563.3%2C%20912.8%20538%20C%20897.9%20528.4%2C%20855.4%20499.8%2C%20827.8%20480.7%20C%20803.3%20463.8%2C%20783.5%20457.4%2C%20763.5%20460.1%22%2F%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M%20595.5%20314.6%20C%20579.6%20318.6%2C%20569.7%20324.2%2C%20559.9%20334.8%20C%20546.6%20349.1%2C%20539.4%20370.2%2C%20544.5%20380%20C%20548.4%20387.4%2C%20555.1%20384.6%2C%20563.6%20371.9%20C%20572.9%20357.9%2C%20586.4%20347.8%2C%20604.5%20341.4%20C%20611.3%20339%2C%20617%20333.3%2C%20617%20328.9%20C%20617%20319.9%2C%20605.3%20312.2%2C%20595.5%20314.6%22%2F%3E%3Cpath%20fill%3D%22%23CFAD63%22%20d%3D%22M%20868.6%20273.5%20C%20854.1%20309.2%2C%20826.9%20340.2%2C%20793.7%20358.9%20L%20787.9%20362.2%20799%20368.8%20C%20830.3%20387.5%2C%20854.5%20416.5%2C%20869.6%20453.3%20L%20872.9%20461.5%20874.5%20457.5%20C%20891.7%20415.7%2C%20914.1%20388.4%2C%20947.8%20368.3%20L%20958.2%20362.2%20949.7%20357.5%20C%20928.8%20345.8%2C%20909.2%20327.4%2C%20894.8%20306%20C%20888%20295.9%2C%20875.8%20272.4%2C%20874.5%20266.8%20C%20873.4%20262.5%2C%20872.8%20263.3%2C%20868.6%20273.5%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E';

/** Kelana logo (light variant for the dark gallery chrome). */
const KELANA_LOGO_SVG = "<svg class=\"contact-logo\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"37 27 2532 711\" role=\"img\" aria-label=\"Kelana\"><path fill=\"#C3C8AE\" d=\"M 281.5 318.7 C 278.6 319, 256.3 322.7, 230.5 327.1 C 223.9 328.3, 214.9 329.6, 210.5 330.1 C 199.3 331.4, 191.6 332.6, 183.5 334.4 C 179.7 335.2, 172.2 336.4, 167 337 C 161.8 337.6, 153.3 339, 148.3 340.1 C 143.2 341.1, 135.9 342.4, 132.1 343 C 119.8 344.7, 117.2 347.5, 118.3 357.3 C 119.3 365.2, 122.3 367.5, 131 366.6 C 148.5 364.8, 188.6 362, 210 361 C 220.2 360.5, 238.2 359.2, 250 358 C 261.8 356.9, 275.3 355.7, 280 355.4 C 295 354.4, 299.3 351.6, 306 338.3 C 314 322.7, 305.3 315.7, 281.5 318.7 M 236 436.6 C 227.5 437.3, 209.7 439.3, 196.5 440.9 C 183.3 442.6, 169.8 444.2, 166.5 444.5 C 163.2 444.9, 156.5 446, 151.5 447 C 146.6 448, 139.4 449.1, 135.5 449.5 C 131.7 449.9, 123.8 451.3, 118 452.6 C 112.2 453.8, 102.9 455.6, 97.2 456.4 C 91.6 457.3, 84.4 458.6, 81.2 459.4 C 78.1 460.2, 71.5 461.4, 66.5 462 C 49.5 464.1, 43.6 469.4, 48.7 478.1 C 51.8 483.4, 53.5 483.6, 83.9 481.7 C 99.1 480.7, 115.9 480, 121.3 480 C 126.7 480, 134.1 479.6, 137.8 479 C 149.7 477.3, 180.9 474.9, 203.5 474 C 215.6 473.6, 226.2 472.9, 227 472.6 C 227.8 472.3, 236.2 471.4, 245.5 470.5 C 265.8 468.7, 271.7 467.2, 277.2 462.2 C 285.5 454.7, 285.3 448.1, 276.3 441.3 C 269.1 435.9, 258.2 434.6, 236 436.6 M 259.5 551.6 C 256.2 552.3, 248.6 553.7, 242.5 554.5 C 236.5 555.4, 225.9 557.2, 219 558.6 C 212.1 559.9, 202.7 561.5, 198 562.1 C 193.3 562.6, 184.1 564.2, 177.5 565.5 C 170.9 566.8, 162.6 568.1, 159 568.5 C 155.4 568.9, 149.1 570, 145 571 C 140.9 572.1, 133.5 573.4, 128.5 574 C 114.3 575.7, 111.2 579.9, 118.3 587.6 L 121.6 591.2 135.6 592.6 C 174.2 596.3, 213.6 592.3, 239.8 581.9 C 265.9 571.5, 281.6 556.1, 270.5 551.4 C 266.5 549.8, 267.2 549.8, 259.5 551.6\"/><path fill=\"#7FA2C2\" fill-rule=\"evenodd\" d=\"M 848 37.7 C 766.2 45.8, 733.2 68.9, 671.9 160.8 C 661.5 176.3, 652.2 190.3, 651.1 191.8 C 640.6 206.6, 618.8 241, 617.9 244.1 C 616.8 247.6, 616.9 248.4, 618.7 250.8 C 621.3 254.4, 622.4 254.7, 658.5 261.6 C 668.1 263.5, 688.8 267.9, 706 271.7 C 725.8 276.1, 754.2 275.8, 768.5 271.1 C 791.5 263.4, 798 258.7, 827.4 228.1 C 847.8 206.8, 861.5 191.3, 870 180 C 884.8 160.3, 897.7 143.2, 900.6 139.5 C 916.3 119, 937.3 88.7, 940.2 82.3 C 946.8 67.3, 943.4 53.5, 931.4 46.8 C 922.3 41.7, 867.6 35.7, 848 37.7 M 475.3 74.1 C 468.6 74.6, 458.7 75.9, 453.3 77 C 447.9 78.2, 440 79.8, 435.7 80.6 C 397.7 87.9, 367.6 108.9, 353.9 137.5 C 345.2 155.6, 342.2 170.3, 340 204.5 C 339.4 213.9, 338.3 227.1, 337.5 234 C 336.8 240.9, 335.9 257.1, 335.6 270 C 335.1 294.5, 333.6 321.1, 331.9 336.5 C 331.3 341.5, 330.5 358.8, 330 375 C 329.6 391.2, 328.7 413.7, 328 425 C 326 460.2, 327.1 647.2, 329.3 657.8 C 336.7 692.2, 356.4 712.2, 388.9 718.1 C 432.8 726.1, 509.7 725.5, 534.6 717 C 550.9 711.4, 559.4 700.5, 562.1 681.7 C 563.2 673.6, 561.8 643.3, 559.5 626.5 C 558.7 621, 557.4 609.1, 556.5 600 C 554.8 581.9, 550.7 549.2, 548.5 536.3 C 545.6 518.8, 537.8 508.6, 518.5 497.2 C 501.1 487, 489.4 475.9, 479.3 460.4 C 464.3 437.1, 458.2 397.6, 464.8 366.6 C 472.4 331.2, 491.1 305, 522 286.5 C 531.1 281, 544 268.3, 547.2 261.8 C 550 256.1, 553.1 242.9, 555 229 C 555.7 224.3, 557.2 215.8, 558.5 210 C 559.8 204.2, 561.6 193.4, 562.5 186 C 563.4 178.6, 564.8 169.6, 565.5 166 C 566.2 162.4, 567.1 156.1, 567.5 152 C 567.8 147.9, 568.8 139.4, 569.7 133.2 C 573.7 103.8, 567.7 86.2, 550.6 78 C 541.2 73.5, 508.8 71.8, 475.3 74.1 M 602 282.9 C 569.2 287.6, 536.7 310.7, 522.3 339.5 C 501 381.9, 511.1 441.4, 544.1 468.8 C 557.2 479.7, 577 490.1, 590.1 493 C 593.7 493.8, 601.1 494.1, 611.5 493.8 C 629.3 493.3, 636.3 491.4, 654.5 482.2 C 698.5 460.1, 720.9 408.8, 708.4 359 C 697 313.5, 645.5 276.7, 602 282.9 M 591.5 315.5 C 564 322.9, 543 347.4, 543 372.1 C 543 388.1, 552.8 388.4, 563.4 372.6 C 573.4 357.7, 584.1 349.5, 602.4 342.6 C 610.6 339.5, 613.7 337.4, 615.6 333.9 C 621.9 321.7, 608 311, 591.5 315.5 M 763.5 460.1 C 748.8 462, 741.1 465.4, 700 487.2 C 686 494.6, 665.1 505.5, 653.5 511.4 C 614.7 531.1, 614.8 530.9, 630.4 552.5 C 642.3 569, 653.4 585.4, 662 599.1 C 674.9 619.8, 693 646.6, 699.6 655 C 702.9 659.1, 707.1 664.8, 709 667.5 C 720.8 684.9, 742 704.7, 760 715.3 C 766.6 719.1, 784 724.6, 795.9 726.6 C 820.2 730.6, 848.3 724.9, 877.8 710.1 C 900.4 698.8, 927.8 676.2, 943.6 656 C 946.8 651.9, 953.2 644.3, 957.7 639.2 C 983.8 609.7, 987.2 592.7, 970.1 576.7 C 965.3 572.2, 952.1 563.3, 912.8 538 C 897.9 528.4, 855.4 499.8, 827.8 480.7 C 803.3 463.8, 783.5 457.4, 763.5 460.1\"/><path fill=\"#FFFFFF\" d=\"M 595.5 314.6 C 579.6 318.6, 569.7 324.2, 559.9 334.8 C 546.6 349.1, 539.4 370.2, 544.5 380 C 548.4 387.4, 555.1 384.6, 563.6 371.9 C 572.9 357.9, 586.4 347.8, 604.5 341.4 C 611.3 339, 617 333.3, 617 328.9 C 617 319.9, 605.3 312.2, 595.5 314.6\"/><path fill=\"#D9B96F\" d=\"M 868.6 273.5 C 854.1 309.2, 826.9 340.2, 793.7 358.9 L 787.9 362.2 799 368.8 C 830.3 387.5, 854.5 416.5, 869.6 453.3 L 872.9 461.5 874.5 457.5 C 891.7 415.7, 914.1 388.4, 947.8 368.3 L 958.2 362.2 949.7 357.5 C 928.8 345.8, 909.2 327.4, 894.8 306 C 888 295.9, 875.8 272.4, 874.5 266.8 C 873.4 262.5, 872.8 263.3, 868.6 273.5\"/><path fill=\"#F3EADF\" d=\"M1180.9 738.4Q1106.3 738.4 1064.3 699.2Q1022.4 660.1 1022.4 585.0L1022.4 585.0Q1022.4 510.0 1064.3 470.9Q1106.3 431.8 1180.9 431.8L1180.9 431.8Q1254.9 431.8 1287.7 470.3Q1320.5 508.9 1320.5 566.2L1320.5 566.2L1320.5 604.0L1150.5 604.0L1150.5 607.1Q1150.5 626.5 1162 635.7Q1173.5 644.9 1200.3 644.9L1200.3 644.9Q1232.3 644.9 1261.2 640.2Q1290.1 635.5 1311.6 628.1L1311.6 628.1L1311.6 712.1Q1293.3 722.1 1257.8 730.2Q1222.4 738.4 1180.9 738.4L1180.9 738.4ZM1150.5 546.2L1211.3 546.2L1211.3 539.9Q1211.3 522.1 1203.7 514.2Q1196.1 506.3 1180.9 506.3L1180.9 506.3Q1165.7 506.3 1158.1 514.4Q1150.5 522.6 1150.5 539.9L1150.5 539.9L1150.5 546.2ZM1513.8 731.5L1346.8 731.5L1346.8 644.9L1369.9 644.9L1369.9 408.7L1346.8 408.7L1346.8 322.6L1490.6 322.6L1490.6 644.9L1513.8 644.9L1513.8 731.5ZM1824.0 644.9L1847.1 644.9L1847.1 731L1708.5 731L1708.5 695.3Q1697.0 712.1 1676.2 725.2Q1655.5 738.4 1625.6 738.4L1625.6 738.4Q1586.2 738.4 1563.6 717.4Q1541.0 696.4 1541.0 658.0L1541.0 658.0Q1541.0 558.8 1709.6 556.2L1709.6 556.2Q1708 538.3 1695.9 531.8Q1683.8 525.2 1655.0 525.2L1655.0 525.2Q1631.3 525.2 1604.3 530.2Q1577.3 535.2 1554.7 543.6L1554.7 543.6L1554.7 447.0Q1582.5 440.2 1615.1 436.0Q1647.6 431.8 1678.6 431.8L1678.6 431.8Q1756.8 431.8 1790.4 460.1Q1824.0 488.5 1824.0 547.8L1824.0 547.8L1824.0 644.9ZM1708.5 611.3L1708.5 608.1Q1684.9 608.1 1672.0 614.5Q1659.2 620.8 1659.2 635.5L1659.2 635.5Q1659.2 644.4 1664.7 649.9Q1670.2 655.4 1680.2 655.4L1680.2 655.4Q1693.8 655.4 1701.2 643.9Q1708.5 632.3 1708.5 611.3L1708.5 611.3ZM2199.9 644.9L2223.0 644.9L2223.0 731L2057.1 731L2057.1 644.9L2079.2 644.9L2079.2 558.8Q2079.2 541.5 2071.8 533.3Q2064.5 525.2 2049.8 525.2L2049.8 525.2Q2018.3 525.2 2018.3 558.8L2018.3 558.8L2018.3 644.9L2040.3 644.9L2040.3 731L1874.4 731L1874.4 644.9L1897.5 644.9L1897.5 525.2L1874.4 525.2L1874.4 439.1L2018.3 439.1L2018.3 480.1Q2056.1 431.8 2112.8 431.8L2112.8 431.8Q2156.3 431.8 2178.1 459.1Q2199.9 486.4 2199.9 534.1L2199.9 534.1L2199.9 644.9ZM2533.3 644.9L2556.4 644.9L2556.4 731L2417.8 731L2417.8 695.3Q2406.3 712.1 2385.5 725.2Q2364.8 738.4 2334.8 738.4L2334.8 738.4Q2295.5 738.4 2272.9 717.4Q2250.3 696.4 2250.3 658.0L2250.3 658.0Q2250.3 558.8 2418.8 556.2L2418.8 556.2Q2417.3 538.3 2405.2 531.8Q2393.1 525.2 2364.3 525.2L2364.3 525.2Q2340.6 525.2 2313.6 530.2Q2286.6 535.2 2264.0 543.6L2264.0 543.6L2264.0 447.0Q2291.8 440.2 2324.3 436.0Q2356.9 431.8 2387.9 431.8L2387.9 431.8Q2466.1 431.8 2499.7 460.1Q2533.3 488.5 2533.3 547.8L2533.3 547.8L2533.3 644.9ZM2417.8 611.3L2417.8 608.1Q2394.2 608.1 2381.3 614.5Q2368.4 620.8 2368.4 635.5L2368.4 635.5Q2368.4 644.4 2374.0 649.9Q2379.5 655.4 2389.4 655.4L2389.4 655.4Q2403.1 655.4 2410.4 643.9Q2417.8 632.3 2417.8 611.3L2417.8 611.3Z\"/></svg>";

/** Contact for bookings, shown under every gallery. */
const KELANA_INSTAGRAM = 'https://www.instagram.com/kelanacirebon_';
const KELANA_WEBSITE = 'https://ruangkelana.com';
const KELANA_WHATSAPP =
  'https://wa.me/6285287560280?text=' +
  encodeURIComponent('Halo Kelana! Saya lihat hasil photobooth-nya dan tertarik sewa photobooth untuk acara saya.');

/** How long the gallery promises to keep a session's files (shown to guests). */
const RETENTION_DAYS = 3;

/** The brand logo with its own class, so header and footer can size it separately. */
const kelanaLogo = (className: string): string =>
  KELANA_LOGO_SVG.replace('class="contact-logo"', `class="${className}"`);

/**
 * Self-contained gallery page served at GET /p/:token.
 *
 * Built for the guest's phone (they arrive by scanning the booth QR): the
 * framed print is the hero with one "save" action, the animated versions sit
 * under it, then every raw photo. Tapping any picture opens a swipeable
 * viewer. On iPhone/iPad saving goes through the share sheet (navigator.share
 * with files) so guests can "Save Image" straight to Photos; Android downloads
 * each file directly (it lands in the phone's gallery); desktops download the
 * file, or a ZIP for several. The page
 * polls the Worker while the booth is still producing outputs, then stops.
 * No external CDNs.
 */
export const renderGallery = (params: {
  token: string;
  qr: string | null;
  createdAt: number | null;
  /** Booth theme (admin Appearance); the page derives its palette from it. */
  theme: BoothTheme;
}): string => {
  const themeVars = Object.entries(themeTokenCssVars(params.theme))
    .map(([name, value]) => `${name}:${value};`)
    .join('');
  const tokenJson = JSON.stringify(params.token);
  const createdAtJson = JSON.stringify(params.createdAt);
  const qrJson = JSON.stringify(params.qr);
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<meta name="robots" content="noindex"/>
<meta name="theme-color" content="#140823"/>
<title>Hasil Fotomu · Kelana</title>
<meta property="og:title" content="Hasil foto photobooth Kelana"/>
<meta property="og:description" content="Lihat dan simpan semua foto dari photobooth Kelana."/>
<link rel="icon" type="image/svg+xml" href="${KELANA_FAVICON}"/>
<style>
  :root { ${themeVars}
    --bg:var(--pbx-ui-bg); --panel:var(--pbx-ui-panel); --raised:var(--pbx-ui-raised); --raised-2:var(--pbx-ui-raised-2);
    --brand:var(--pbx-ui-brand); --brand-fg:var(--pbx-ui-brand-fg); --hi:var(--pbx-ui-hi); --hi-fg:var(--pbx-ui-hi-fg);
    --fg:#fff; --fg-2:rgba(255,255,255,.68); --fg-3:rgba(255,255,255,.48); --line:rgba(255,255,255,.1);
    --gutter-l:max(16px, env(safe-area-inset-left, 0px)); --gutter-r:max(16px, env(safe-area-inset-right, 0px));
    color-scheme:dark;
  }
  * { box-sizing:border-box; }
  html, body { margin:0; }
  body {
    min-height:100vh; color:var(--fg); background-color:var(--bg);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; -webkit-font-smoothing:antialiased;
    background-image:
      radial-gradient(640px 360px at 50% -80px, rgb(var(--pbx-ui-secondary-rgb) / .3), transparent 70%),
      linear-gradient(180deg, var(--bg) 0%, var(--panel) 55%, var(--raised) 100%);
    background-attachment:fixed;
  }
  button { font:inherit; color:inherit; }
  :focus-visible { outline:3px solid var(--hi); outline-offset:2px; }
  .hidden { display:none !important; }
  .wrap { max-width:1080px; margin:0 auto; padding-left:var(--gutter-l); padding-right:var(--gutter-r); }

  /* Header */
  .ghead { padding-top:calc(20px + env(safe-area-inset-top, 0px)); padding-bottom:4px; display:grid; gap:6px; }
  .brand-logo { display:block; height:26px; width:auto; }
  .gtitle { margin:10px 0 0; font-size:1.6rem; line-height:1.15; font-weight:850; letter-spacing:-.01em; text-wrap:balance; }
  .gsub { margin:0; font-size:.88rem; color:var(--fg-2); }
  .gprint { justify-self:start; display:inline-flex; align-items:center; gap:6px; margin-top:4px; padding:4px 11px; border-radius:999px; font-size:.78rem; font-weight:700; background:rgba(255,255,255,.08); }
  .gprint.ok { background:rgb(var(--pbx-ui-hi-rgb) / .16); color:var(--hi); }
  .gprint.err { background:rgba(255,94,135,.15); color:#ff8aa8; }
  .gprint:empty { display:none; }

  /* Notes (still generating / errors) */
  .note { margin-top:16px; display:flex; gap:10px; align-items:center; padding:11px 13px; border-radius:12px; background:rgb(var(--pbx-ui-hi-rgb) / .1); border:1px solid rgb(var(--pbx-ui-hi-rgb) / .38); font-size:.86rem; line-height:1.4; }
  .note.err { background:rgba(255,94,135,.12); border-color:rgba(255,94,135,.5); color:#ffd0e0; }
  .spin { width:15px; height:15px; flex-shrink:0; border:2px solid rgb(var(--pbx-ui-hi-rgb) / .35); border-top-color:var(--hi); border-radius:50%; animation:spin 1s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }

  /* Layout: hero + animated on the left, photos on the right (desktop); stacked on phones. */
  .layout { display:grid; gap:8px; }
  @media (min-width:960px) { .layout { grid-template-columns:minmax(0,5fr) minmax(0,7fr); gap:40px; align-items:start; } .col-a { position:sticky; top:16px; } }
  .col-a, .col-b { min-width:0; }

  .hero { padding-top:18px; display:grid; gap:14px; }
  .hero-img { justify-self:center; display:block; border:0; padding:0; background:none; cursor:zoom-in; border-radius:6px; box-shadow:0 18px 44px rgba(0,0,0,.55); transform:rotate(-1.2deg); transition:transform .2s ease; max-width:100%; }
  .hero-img:hover { transform:rotate(0deg) scale(1.01); }
  .hero-img img { display:block; max-height:clamp(240px, calc(100vh - 340px), 460px); max-height:clamp(240px, calc(100svh - 340px), 460px); max-width:100%; width:auto; height:auto; border-radius:6px; }
  .hero-skel { justify-self:center; width:min(150px, 42vw); aspect-ratio:1/3; border-radius:8px; }
  .row { display:flex; gap:10px; }
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:48px; padding:0 20px; border-radius:14px; border:0; cursor:pointer; font-weight:800; font-size:.95rem; text-decoration:none; transition:transform .12s ease, opacity .12s ease; }
  .btn:active { transform:scale(.98); }
  .btn svg { width:20px; height:20px; flex-shrink:0; }
  .btn:disabled { opacity:.5; cursor:not-allowed; }
  .btn-primary { flex:1; background:var(--brand); color:var(--brand-fg); }
  .btn-ghost { background:rgba(255,255,255,.1); color:var(--fg); }
  .btn-sm { min-height:36px; padding:0 14px; border-radius:10px; font-size:.84rem; }
  .expiry { margin:0; font-size:.8rem; color:var(--fg-3); text-align:center; line-height:1.45; }
  .expiry b { color:var(--fg-2); }

  .sec { padding-top:28px; }
  .sec-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; }
  .sec-head h2 { margin:0; font-size:1.05rem; font-weight:800; }
  .sec-head h2 span { color:var(--fg-3); font-weight:600; margin-left:4px; }
  .anim { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .acard { min-width:0; background:rgba(255,255,255,.05); border:1px solid var(--line); border-radius:16px; padding:8px; display:grid; gap:8px; }
  .thumb { position:relative; aspect-ratio:1/1; border-radius:10px; overflow:hidden; background:rgba(0,0,0,.35); border:0; padding:0; cursor:zoom-in; width:100%; display:block; }
  .thumb img { width:100%; height:100%; object-fit:contain; display:block; }
  .tag { position:absolute; top:7px; left:7px; padding:3px 7px; border-radius:6px; font-size:.66rem; font-weight:900; letter-spacing:.08em; background:rgba(0,0,0,.65); color:#fff; }
  .tag.live { background:var(--brand); color:var(--brand-fg); }
  .acard-foot { display:flex; align-items:center; justify-content:space-between; gap:6px; padding:0 2px 2px; }
  .acard-foot b { font-size:.86rem; }
  .icon-btn { width:38px; height:38px; flex-shrink:0; border-radius:10px; border:0; background:rgba(255,255,255,.1); display:grid; place-items:center; cursor:pointer; color:var(--fg); }
  .icon-btn svg { width:18px; height:18px; }

  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
  @media (min-width:640px) { .grid { grid-template-columns:repeat(4,1fr); gap:8px; } }
  .tile { position:relative; aspect-ratio:1/1; border-radius:10px; overflow:hidden; border:0; padding:0; background:#000; cursor:pointer; display:block; width:100%; }
  .tile img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .15s ease; }
  .tile .chk { position:absolute; top:6px; right:6px; width:24px; height:24px; border-radius:50%; border:2px solid #fff; background:rgba(0,0,0,.35); display:none; place-items:center; font-size:13px; font-weight:900; color:var(--brand-fg); }
  .selecting .tile .chk { display:grid; }
  .tile[aria-checked="true"] img { transform:scale(.88); border-radius:8px; }
  .tile[aria-checked="true"] .chk { background:var(--brand); border-color:var(--brand); }
  .skel { aspect-ratio:1/1; border-radius:10px; background:linear-gradient(100deg, rgba(255,255,255,.06) 30%, rgba(255,255,255,.13) 50%, rgba(255,255,255,.06) 70%); background-size:300% 100%; animation:shimmer 1.4s ease-in-out infinite; }
  @keyframes shimmer { from { background-position:100% 0; } to { background-position:0 0; } }
  .status { text-align:center; padding:28px 0 8px; color:var(--fg-2); font-size:.92rem; }
  .gone { text-align:center; padding:60px 8px; color:#ffd0e0; font-weight:700; line-height:1.5; }

  /* Contact */
  .contact { margin-top:36px; padding:24px 0 8px; border-top:1px solid var(--line); display:grid; gap:12px; justify-items:center; text-align:center; }
  .contact-logo { display:block; height:34px; width:auto; }
  .contact p { margin:0; max-width:440px; font-size:.9rem; line-height:1.5; color:var(--fg-2); }
  .contact p b { display:block; color:var(--fg); font-size:1.02rem; margin-bottom:2px; }
  .contact .row { flex-wrap:wrap; justify-content:center; }
  .wa { background:#25D366; color:#073B1C; }
  .ig { background:linear-gradient(45deg,#F58529,#DD2A7B 55%,#8134AF); color:#fff; }
  .site-link { display:inline-flex; align-items:center; gap:7px; padding:6px 4px; color:var(--fg-2); font-size:.9rem; font-weight:700; text-decoration:none; border-bottom:1px solid transparent; }
  .site-link:hover { color:var(--fg); border-bottom-color:currentColor; }
  .site-link svg { width:17px; height:17px; flex-shrink:0; }
  footer { text-align:center; padding:12px 0 22px; color:var(--fg-3); font-size:.76rem; }

  /* Sticky save bar */
  .dock { position:sticky; bottom:0; z-index:5; margin-top:8px; padding-top:14px; padding-bottom:calc(12px + env(safe-area-inset-bottom, 0px)); display:flex; gap:10px; align-items:center;
    background:linear-gradient(0deg, var(--raised) 62%, rgb(var(--pbx-ui-raised-rgb) / 0)); }
  .dock .count { flex:1; font-size:.9rem; font-weight:700; }
  .dock .btn-primary { flex:1; }
  .dock .count + .btn-primary { flex:0 0 auto; }
  @media (min-width:960px) { .dock { max-width:420px; margin-left:auto; } }

  /* Viewer */
  .viewer { position:fixed; inset:0; z-index:50; background:#08030f; display:flex; flex-direction:column; }
  .v-top { display:flex; align-items:center; justify-content:space-between; padding:calc(12px + env(safe-area-inset-top, 0px)) var(--gutter-r) 8px var(--gutter-l); }
  .v-ctr { font-size:.88rem; font-weight:700; color:var(--fg-2); font-variant-numeric:tabular-nums; }
  .v-stage { flex:1; min-height:0; position:relative; overflow:hidden; touch-action:pan-y pinch-zoom; }
  /* Absolutely centered so max-height resolves against the stage: tall framed strips shrink to fit instead of being cut off. */
  .v-stage img { position:absolute; inset:0; margin:auto; width:auto; height:auto; max-width:calc(100% - 24px); max-height:calc(100% - 8px); object-fit:contain; border-radius:6px; transition:transform .2s ease, opacity .2s ease; user-select:none; -webkit-user-drag:none; }
  .v-spin { position:absolute; left:50%; top:50%; width:34px; height:34px; margin:-17px 0 0 -17px; border-width:3px; }
  .v-nav { position:absolute; top:50%; transform:translateY(-50%); width:42px; height:42px; border-radius:50%; border:0; background:rgba(255,255,255,.12); cursor:pointer; display:grid; place-items:center; color:#fff; }
  .v-nav svg { width:20px; height:20px; }
  .v-prev { left:max(10px, env(safe-area-inset-left, 0px)); }
  .v-next { right:max(10px, env(safe-area-inset-right, 0px)); }
  .v-bot { padding:12px var(--gutter-r) calc(16px + env(safe-area-inset-bottom, 0px)) var(--gutter-l); display:grid; gap:10px; width:100%; max-width:520px; margin:0 auto; }
  .v-name { text-align:center; font-size:.82rem; color:var(--fg-3); }
  .dots { display:flex; justify-content:center; flex-wrap:wrap; gap:5px; }
  .dots i { width:6px; height:6px; border-radius:3px; background:rgba(255,255,255,.25); transition:width .2s ease; }
  .dots i.on { background:#fff; width:16px; }

  /* Share fallback (link + QR) */
  .modal { position:fixed; inset:0; z-index:60; background:rgba(0,0,0,.6); display:flex; align-items:flex-end; justify-content:center; }
  @media (min-width:640px) { .modal { align-items:center; } }
  .sheet { width:100%; max-width:420px; background:#fff; color:var(--pbx-ink, #1b1424); border-radius:20px 20px 0 0; padding:22px var(--gutter-r) calc(20px + env(safe-area-inset-bottom, 0px)) var(--gutter-l); display:grid; grid-template-columns:minmax(0, 1fr); gap:12px; justify-items:center; text-align:center; animation:up .22s ease; }
  @media (min-width:640px) { .sheet { border-radius:20px; } }
  @keyframes up { from { transform:translateY(30px); opacity:0; } }
  .sheet h2 { margin:0; font-size:1.05rem; }
  .sheet p { margin:0; font-size:.84rem; color:#5b5368; }
  .sheet img { width:min(220px, 60vw); height:auto; border-radius:12px; }
  .linkbox { width:100%; min-width:0; display:flex; gap:8px; align-items:center; background:#f1eef5; border-radius:12px; padding:6px 6px 6px 12px; }
  .linkbox span { flex:1; min-width:0; font-size:.78rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:left; color:#3b3346; }
  .linkbox .btn { min-height:36px; background:var(--brand); color:var(--brand-fg); flex:0 0 auto; }
  .sheet .btn-close { width:100%; background:#f1eef5; color:#1b1424; }

  .toast { position:fixed; left:50%; bottom:calc(88px + env(safe-area-inset-bottom, 0px)); transform:translateX(-50%); z-index:70; background:#fff; color:#1b1424; padding:11px 16px; border-radius:12px; font-size:.86rem; font-weight:700; box-shadow:0 10px 30px rgba(0,0,0,.4); max-width:calc(100% - 32px); display:flex; gap:10px; align-items:center; }
  .toast button { border:0; background:var(--brand); color:var(--brand-fg); font-weight:800; border-radius:8px; padding:6px 10px; cursor:pointer; }

  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none !important; transition:none !important; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="ghead">
    ${kelanaLogo('brand-logo')}
    <h1 class="gtitle">Hasil fotomu sudah siap</h1>
    <p class="gsub" id="timeText"></p>
    <span class="gprint" id="printPill" role="status"></span>
  </header>
  <div id="note"></div>
  <main id="content"><div class="status">Memuat fotomu&hellip;</div></main>
  <section class="contact" aria-label="Kontak Kelana">
    ${KELANA_LOGO_SVG}
    <p><b>Suka hasil fotonya?</b>Bikin acaramu makin seru dengan photobooth Kelana: pernikahan, ulang tahun, wisuda, sampai gathering kantor.</p>
    <div class="row">
      <a class="btn btn-sm wa" href="${KELANA_WHATSAPP}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z"/></svg>
        Chat via WhatsApp
      </a>
      <a class="btn btn-sm ig" href="${KELANA_INSTAGRAM}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
        @kelanacirebon_
      </a>
    </div>
    <a class="site-link" href="${KELANA_WEBSITE}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg>
      ruangkelana.com
    </a>
  </section>
  <footer>Kelana Photobooth &middot; Cirebon</footer>
  <div class="dock hidden" id="dock"></div>
</div>
<script>
const TOKEN = ${tokenJson};
const CREATED_AT = ${createdAtJson};
const QR = ${qrJson};
const RETENTION_DAYS = ${RETENTION_DAYS};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// iPhone/iPad save through the share sheet ("Simpan Gambar" lands in Photos):
// Safari has no direct download to the photo library. Android's share sheet
// has no "save" target (only apps like WhatsApp), so Android downloads the
// file directly, where it shows up in the phone's gallery. Desktops download
// too, several files as one ZIP.
const IS_TOUCH = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_ANDROID = /Android/i.test(navigator.userAgent);

const ICON = {
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v13"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  l: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
  r: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>'
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const store = { files: [], photos: [], framed: null, live: null, gif: null, viewItems: [] };
const ui = { selecting: false, selected: new Set(), noteError: null, viewIndex: -1 };

// Booth progress signals. print-request/print-result.json carry the timed
// flow's "customer arranged, booth is generating outputs" lifecycle; upload
// activity (file-key changes observed while this page is open) covers the
// non-timed flow which streams all outputs up in one shot.
const CONTROL = { printRequest: null, printResult: null };
let changeCount = 0;
let lastChangeAt = 0;
let lastFiles = [];

function esc(value) {
  return String(value).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function formatDate(ts, withTime) {
  const d = new Date(ts);
  let out = d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  if (withTime) out += ', ' + String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0');
  return out;
}

function expiryText() {
  if (CREATED_AT) {
    return 'Foto disimpan ' + RETENTION_DAYS + ' hari, sampai <b>' + formatDate(CREATED_AT + RETENTION_DAYS * 86400000, false) + '</b>. Simpan sekarang supaya tidak hilang.';
  }
  return 'Foto hanya disimpan <b>' + RETENTION_DAYS + ' hari</b>. Simpan sekarang supaya tidak hilang.';
}

function fetchJson(name) {
  return fetch(location.origin + '/d/' + TOKEN + '/' + name + '?ts=' + Date.now())
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
let toastTimer = null;
function toast(message, action) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.label;
    btn.addEventListener('click', function () { el.remove(); action.run(); });
    el.appendChild(btn);
  }
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.remove(); }, action ? 8000 : 2600);
}

// ---------------------------------------------------------------------------
// Saving: share sheet on iOS, direct download on Android, download / ZIP on desktop
// ---------------------------------------------------------------------------
function downloadUrl(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Every file is fetched at most once per page view (share + ZIP reuse it).
const blobCache = new Map();
function fetchBlob(item) {
  if (!blobCache.has(item.url)) {
    blobCache.set(item.url, fetch(item.url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).catch(function (error) { blobCache.delete(item.url); throw error; }));
  }
  return blobCache.get(item.url);
}

function mimeFor(name, blob) {
  if (/[.]gif$/i.test(name)) return 'image/gif';
  if (/[.]png$/i.test(name)) return blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'image/png';
  return 'image/jpeg';
}

// Browsers only honor a handful of programmatic downloads per user gesture, so
// several files are packed into one .zip instead of a burst of downloads.
//
// ZIP entries are written with the STORE method (no deflate): every output is
// already a compressed format (JPEG/PNG/GIF), so deflating would burn CPU for
// almost no size win — and it keeps the whole archive buildable in one pass.
const CRC_TABLE = (function () {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// MS-DOS date/time pair used by the ZIP local + central headers.
function dosStamp(date) {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { time: time, date: day };
}

// entries: [{ name: string, bytes: Uint8Array }] -> Blob of a valid .zip
function buildZip(entries) {
  const encoder = new TextEncoder();
  const stamp = dosStamp(new Date());
  const parts = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const size = entry.bytes.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);      // local file header signature
    lv.setUint16(4, 20, true);              // version needed to extract
    lv.setUint16(6, 0x0800, true);          // UTF-8 filename flag
    lv.setUint16(8, 0, true);               // method 0 = stored
    lv.setUint16(10, stamp.time, true);
    lv.setUint16(12, stamp.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);           // compressed size
    lv.setUint32(22, size, true);           // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);              // extra field length
    local.set(nameBytes, 30);
    parts.push(local, entry.bytes);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);      // central directory signature
    cv.setUint16(4, 20, true);              // version made by
    cv.setUint16(6, 20, true);              // version needed
    cv.setUint16(8, 0x0800, true);          // UTF-8 filename flag
    cv.setUint16(10, 0, true);              // method 0 = stored
    cv.setUint16(12, stamp.time, true);
    cv.setUint16(14, stamp.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);              // extra field length
    cv.setUint16(32, 0, true);              // comment length
    cv.setUint16(34, 0, true);              // disk number start
    cv.setUint16(36, 0, true);              // internal attributes
    cv.setUint32(38, 0, true);              // external attributes
    cv.setUint32(42, offset, true);         // relative offset of local header
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length + size;
  }

  const centralSize = centrals.reduce(function (sum, c) { return sum + c.length; }, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);        // end of central directory signature
  ev.setUint16(4, 0, true);                 // this disk number
  ev.setUint16(6, 0, true);                 // disk with central directory
  ev.setUint16(8, entries.length, true);    // entries on this disk
  ev.setUint16(10, entries.length, true);   // total entries
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);           // central directory offset
  ev.setUint16(20, 0, true);                // archive comment length

  return new Blob(parts.concat(centrals, [end]), { type: 'application/zip' });
}

function setBusy(btn, label) {
  if (!btn) return function () {};
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = label;
  return function () { btn.innerHTML = original; btn.disabled = false; };
}

function showDownloadError() {
  ui.noteError = '<div class="note err">Foto belum bisa disimpan. Cek koneksi internetmu lalu coba lagi, atau minta bantuan petugas booth.</div>';
  renderNote();
}

async function shareFiles(files) {
  try {
    await navigator.share({ files: files });
    return 'ok';
  } catch (error) {
    if (error && error.name === 'AbortError') return 'cancelled';
    // Fetching took long enough that the tap no longer counts as the user's
    // gesture: the files are ready now, so one more tap opens the sheet.
    if (error && error.name === 'NotAllowedError') return 'gesture';
    return 'failed';
  }
}

async function saveItems(items, btn, zipName) {
  if (!items.length) return;
  ui.noteError = null;
  renderNote();

  if (IS_IOS && navigator.canShare) {
    const restore = setBusy(btn, 'Menyiapkan…');
    let files;
    try {
      const blobs = await Promise.all(items.map(fetchBlob));
      files = blobs.map(function (blob, i) {
        return new File([blob], items[i].name, { type: mimeFor(items[i].name, blob) });
      });
    } catch (error) {
      restore();
      showDownloadError();
      return;
    }
    restore();
    if (navigator.canShare({ files: files })) {
      const result = await shareFiles(files);
      if (result === 'gesture') {
        toast(files.length > 1 ? files.length + ' file siap disimpan' : 'Foto siap disimpan', {
          label: 'Simpan',
          run: function () { shareFiles(files); },
        });
      }
      if (result !== 'failed') return;
    }
  }

  if (items.length === 1) {
    downloadUrl(items[0].url, items[0].name);
    return;
  }
  if (IS_ANDROID) {
    // A ZIP never reaches the gallery app on Android, so each file is
    // downloaded on its own (Chrome asks once to allow multiple downloads).
    const restore = setBusy(btn, 'Mengunduh…');
    for (let i = 0; i < items.length; i++) {
      downloadUrl(items[i].url, items[i].name);
      if (i < items.length - 1) await new Promise(function (r) { setTimeout(r, 600); });
    }
    restore();
    toast(items.length + ' file diunduh ke galeri');
    return;
  }
  const restore = setBusy(btn, 'Menyiapkan 0 / ' + items.length);
  try {
    const entries = [];
    for (let i = 0; i < items.length; i++) {
      if (btn) btn.textContent = 'Menyiapkan ' + (i + 1) + ' / ' + items.length;
      try {
        entries.push({ name: items[i].name, bytes: new Uint8Array(await (await fetchBlob(items[i])).arrayBuffer()) });
      } catch (error) {
        // Skip a file that will not load; the rest still downloads.
      }
    }
    if (entries.length === 0) {
      showDownloadError();
      return;
    }
    const href = URL.createObjectURL(buildZip(entries));
    downloadUrl(href, zipName);
    // Give the browser time to start the download before dropping the blob.
    setTimeout(function () { URL.revokeObjectURL(href); }, 60000);
  } catch (error) {
    showDownloadError();
  } finally {
    restore();
  }
}

function allItems() {
  return [store.framed, store.live, store.gif].filter(Boolean).concat(store.photos);
}

function saveKey(key, btn) {
  if (key === 'framed' && store.framed) return saveItems([store.framed], btn);
  if (key === 'live' && store.live) return saveItems([store.live], btn);
  if (key === 'gif' && store.gif) return saveItems([store.gif], btn);
  if (key === 'current') {
    const item = store.viewItems[ui.viewIndex];
    if (item) saveItems([item], btn);
    return;
  }
  if (key === 'selected') {
    const items = store.photos.filter(function (p) { return ui.selected.has(p.name); });
    return saveItems(items, btn, 'foto-pilihan-' + TOKEN + '.zip');
  }
  if (key === 'all') return saveItems(allItems(), btn, 'kelana-' + TOKEN + '.zip');
}

// ---------------------------------------------------------------------------
// Share the gallery link (native sheet, else link + QR)
// ---------------------------------------------------------------------------
async function shareLink() {
  const url = location.origin + location.pathname;
  if (IS_TOUCH && navigator.share) {
    try {
      await navigator.share({ title: 'Hasil foto photobooth Kelana', url: url });
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }
  openLinkSheet(url);
}

function openLinkSheet(url) {
  closeLinkSheet();
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'linkSheet';
  modal.innerHTML =
    '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="linkTitle">' +
      '<h2 id="linkTitle">Bagikan galeri ini</h2>' +
      '<p>Teman bisa scan QR ini atau buka link-nya.</p>' +
      (QR ? '<img src="' + QR + '" alt="QR galeri"/>' : '') +
      '<div class="linkbox"><span id="linkText"></span><button class="btn" type="button" id="copyLink">Salin</button></div>' +
      '<button class="btn btn-close" type="button" id="closeLink">Tutup</button>' +
    '</div>';
  document.body.appendChild(modal);
  modal.querySelector('#linkText').textContent = url;
  modal.addEventListener('click', function (e) { if (e.target === modal) closeLinkSheet(); });
  modal.querySelector('#closeLink').addEventListener('click', closeLinkSheet);
  modal.querySelector('#copyLink').addEventListener('click', function () {
    const done = function () { toast('Link disalin'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function () { selectLinkText(); });
    } else {
      selectLinkText();
    }
  });
  modal.querySelector('#copyLink').focus();
}

function selectLinkText() {
  const el = document.getElementById('linkText');
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  toast('Tekan lama untuk menyalin link');
}

function closeLinkSheet() {
  const old = document.getElementById('linkSheet');
  if (old) old.remove();
}

// ---------------------------------------------------------------------------
// Viewer (swipe / arrows / keyboard)
// ---------------------------------------------------------------------------
let viewerEl = null;
let lastFocus = null;

function openViewer(index) {
  if (!store.viewItems.length) return;
  closeViewer();
  lastFocus = document.activeElement;
  ui.viewIndex = index;
  viewerEl = document.createElement('div');
  viewerEl.className = 'viewer';
  viewerEl.setAttribute('role', 'dialog');
  viewerEl.setAttribute('aria-modal', 'true');
  viewerEl.setAttribute('aria-label', 'Lihat foto');
  const many = store.viewItems.length > 1;
  viewerEl.innerHTML =
    '<div class="v-top"><span class="v-ctr" id="vCtr"></span><button class="icon-btn" type="button" id="vClose" aria-label="Tutup">' + ICON.x + '</button></div>' +
    '<div class="v-stage" id="vStage"><img id="vImg" alt=""/><span class="spin v-spin hidden" id="vSpin" aria-hidden="true"></span>' +
      (many ? '<button class="v-nav v-prev" type="button" id="vPrev" aria-label="Sebelumnya">' + ICON.l + '</button>' +
              '<button class="v-nav v-next" type="button" id="vNext" aria-label="Berikutnya">' + ICON.r + '</button>' : '') +
    '</div>' +
    '<div class="v-bot">' + (many ? '<div class="dots" id="vDots" aria-hidden="true"></div>' : '') +
      '<div class="v-name" id="vName"></div>' +
      '<div class="row"><button class="btn btn-primary" type="button" id="vSave">' + ICON.dl + 'Simpan</button></div>' +
    '</div>';
  document.body.appendChild(viewerEl);
  document.body.style.overflow = 'hidden';

  const stage = viewerEl.querySelector('#vStage');
  let x0 = null;
  let y0 = null;
  stage.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { x0 = null; return; }
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) stepViewer(dx < 0 ? 1 : -1);
  });
  viewerEl.querySelector('#vClose').addEventListener('click', closeViewer);
  viewerEl.querySelector('#vSave').addEventListener('click', function (e) { saveKey('current', e.currentTarget); });
  if (many) {
    viewerEl.querySelector('#vPrev').addEventListener('click', function () { stepViewer(-1); });
    viewerEl.querySelector('#vNext').addEventListener('click', function () { stepViewer(1); });
  }
  showViewerItem(0);
  viewerEl.querySelector('#vClose').focus();
}

// Viewer images are the full-size originals, so each one is fetched once,
// decoded off-screen and only then swapped in. The neighbours are warmed up in
// the background so next / previous is usually instant.
const imageLoads = new Map();
function loadImage(url) {
  if (!imageLoads.has(url)) {
    imageLoads.set(url, new Promise(function (resolve, reject) {
      const im = new Image();
      im.onload = function () {
        if (im.decode) im.decode().then(resolve, resolve);
        else resolve();
      };
      im.onerror = function () { imageLoads.delete(url); reject(new Error('load failed')); };
      im.src = url;
    }));
  }
  return imageLoads.get(url);
}

function preloadAround(index) {
  const n = store.viewItems.length;
  [1, -1, 2].forEach(function (offset) {
    const item = store.viewItems[(index + offset + n) % n];
    if (item) loadImage(item.url).catch(function () {});
  });
}

let viewSeq = 0;
function showViewerItem(dir) {
  if (!viewerEl) return;
  const item = store.viewItems[ui.viewIndex];
  if (!item) return;
  const seq = ++viewSeq;
  const img = viewerEl.querySelector('#vImg');
  const spin = viewerEl.querySelector('#vSpin');

  // Counter, name and dots move right away so every tap is acknowledged.
  viewerEl.querySelector('#vCtr').textContent = (ui.viewIndex + 1) + ' / ' + store.viewItems.length;
  viewerEl.querySelector('#vName').textContent = item.label;
  const dots = viewerEl.querySelector('#vDots');
  if (dots) {
    dots.innerHTML = store.viewItems.map(function (_, i) { return '<i' + (i === ui.viewIndex ? ' class="on"' : '') + '></i>'; }).join('');
  }

  // The outgoing picture fades so it never looks like the old one is stuck.
  if (dir) {
    img.style.opacity = '0';
    img.style.transform = 'translateX(' + (-dir * 24) + 'px)';
  }
  const spinTimer = setTimeout(function () { if (seq === viewSeq) spin.classList.remove('hidden'); }, 150);

  const swap = function () {
    if (seq !== viewSeq || !viewerEl) return;
    clearTimeout(spinTimer);
    spin.classList.add('hidden');
    img.src = item.url;
    img.alt = item.label;
    img.style.transition = 'none';
    img.style.transform = dir ? 'translateX(' + (dir * 24) + 'px)' : 'none';
    img.style.opacity = '0';
    // Next frame: slide/fade the new picture in.
    requestAnimationFrame(function () {
      img.style.transition = '';
      img.style.opacity = '1';
      img.style.transform = 'none';
    });
  };
  loadImage(item.url).then(swap, swap);
  preloadAround(ui.viewIndex);
}

function stepViewer(delta) {
  const n = store.viewItems.length;
  if (n < 2) return;
  ui.viewIndex = (ui.viewIndex + delta + n) % n;
  showViewerItem(delta);
}

function closeViewer() {
  if (!viewerEl) return;
  viewerEl.remove();
  viewerEl = null;
  document.body.style.overflow = '';
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Whether the session is still producing outputs. Timed flow is driven by
 * print-request/print-result.json (the booth generates framed.png + GIFs only
 * AFTER the customer arranges, so print-result 'ok' is the completion signal);
 * the non-timed flow streams everything up at once, so observed upload
 * activity within the last few seconds is the signal there.
 */
function pendingNote(files) {
  if (files.length === 0) return null;
  const names = files.map(function (f) { return f.name; });
  if (CONTROL.printResult) {
    if (CONTROL.printResult.status === 'ok') return null;
    if (CONTROL.printResult.status === 'error') return 'error';
    return 'busy';
  }
  if (CONTROL.printRequest) {
    if (CONTROL.printRequest.status !== 'handled') return 'busy';
    if (names.indexOf('print-result.json') < 0) return 'busy';
    return null;
  }
  if (changeCount > 1 && Date.now() - lastChangeAt < 12000) return 'busy';
  return null;
}

function renderNote() {
  const box = document.getElementById('note');
  if (!box) return;
  if (ui.noteError) {
    box.innerHTML = ui.noteError;
    return;
  }
  const state = pendingNote(lastFiles);
  if (state === 'busy') {
    box.innerHTML = '<div class="note" role="status"><span class="spin" aria-hidden="true"></span>Sebagian hasil masih dibuat. Halaman ini akan terisi sendiri, tidak perlu di-refresh.</div>';
  } else if (state === 'error') {
    box.innerHTML = '<div class="note err">Sebagian hasil gagal dibuat. Minta bantuan petugas booth ya.</div>';
  } else {
    box.innerHTML = '';
  }
}

function classify(files) {
  store.files = files.filter(function (f) {
    return !/^(meta|organize|print-request|print-result|live-clips)[.]json$/i.test(f.name);
  });
  store.framed = null;
  store.live = null;
  store.gif = null;
  store.photos = [];
  store.files.forEach(function (f) {
    if (/framed[.]png$/i.test(f.name)) store.framed = { url: f.url, name: f.name, label: 'Foto dengan bingkai' };
    else if (/result-live[.]gif$/i.test(f.name)) store.live = { url: f.url, name: f.name, label: 'Live photo' };
    else if (/[.]gif$/i.test(f.name)) { if (!store.gif) store.gif = { url: f.url, name: f.name, label: 'GIF' }; }
    else if (/[.](jpe?g|png)$/i.test(f.name)) store.photos.push({ url: f.url, name: f.name, label: '' });
  });
  store.photos.forEach(function (p, i) { p.label = 'Foto ' + (i + 1); });
  store.viewItems = allItems();
  // Drop selections whose photo no longer exists.
  ui.selected.forEach(function (name) {
    if (!store.photos.some(function (p) { return p.name === name; })) ui.selected.delete(name);
  });
}

function viewIndexOf(item) {
  return store.viewItems.indexOf(item);
}

function render(files) {
  const root = document.getElementById('content');
  lastFiles = files;
  renderNote();

  if (files.length === 0) {
    root.innerHTML =
      '<div class="hero"><div class="skel hero-skel"></div></div>' +
      '<div class="status">Fotomu sedang diunggah. Halaman ini akan terisi sendiri.</div>';
    renderDock();
    return;
  }

  classify(files);
  const busy = pendingNote(files) === 'busy';
  let html = '<div class="layout"><div class="col-a">';

  // Hero: the framed print.
  if (store.framed || busy) {
    html += '<section class="hero" aria-label="Foto utama">';
    if (store.framed) {
      html += '<button class="hero-img" type="button" data-open="' + viewIndexOf(store.framed) + '" aria-label="Lihat foto dengan bingkai">' +
        '<img src="' + esc(store.framed.url) + '" alt="Foto dengan bingkai"/></button>';
    } else {
      html += '<div class="skel hero-skel" aria-hidden="true"></div>';
    }
    html += '<div class="row">' +
        '<button class="btn btn-primary" type="button" data-save="framed"' + (store.framed ? '' : ' disabled') + '>' + ICON.dl + 'Simpan foto</button>' +
        '<button class="btn btn-ghost" type="button" data-sharelink aria-label="Bagikan link galeri">' + ICON.share + 'Bagikan</button>' +
      '</div>' +
      '<p class="expiry">' + expiryText() + '</p>' +
    '</section>';
  } else {
    html += '<section class="hero" aria-label="Info">' +
      '<div class="row"><button class="btn btn-ghost" type="button" data-sharelink style="flex:1">' + ICON.share + 'Bagikan galeri</button></div>' +
      '<p class="expiry">' + expiryText() + '</p></section>';
  }

  // Animated versions.
  const anim = [];
  if (store.live) anim.push({ item: store.live, key: 'live', tag: '<span class="tag live">LIVE</span>' });
  if (store.gif) anim.push({ item: store.gif, key: 'gif', tag: '<span class="tag">GIF</span>' });
  if (anim.length || busy) {
    html += '<section class="sec" aria-label="Versi bergerak"><div class="sec-head"><h2>Versi bergerak</h2></div><div class="anim">';
    anim.forEach(function (a) {
      html += '<div class="acard">' +
        '<button class="thumb" type="button" data-open="' + viewIndexOf(a.item) + '" aria-label="Lihat ' + esc(a.item.label) + '">' +
          '<img src="' + esc(a.item.url) + '" alt="' + esc(a.item.label) + '" loading="lazy"/>' + a.tag + '</button>' +
        '<div class="acard-foot"><b>' + esc(a.item.label) + '</b>' +
          '<button class="icon-btn" type="button" data-save="' + a.key + '" aria-label="Simpan ' + esc(a.item.label) + '">' + ICON.dl + '</button></div>' +
      '</div>';
    });
    if (busy) {
      for (let i = anim.length; i < 2; i++) html += '<div class="acard"><div class="skel" aria-hidden="true"></div><div class="acard-foot"><b style="color:var(--fg-3)">Sedang dibuat…</b></div></div>';
    }
    html += '</div></section>';
  }
  html += '</div><div class="col-b">';

  // Raw photos.
  if (store.photos.length) {
    html += '<section class="sec' + (ui.selecting ? ' selecting' : '') + '" aria-label="Semua foto">' +
      '<div class="sec-head"><h2>Semua foto<span>' + store.photos.length + '</span></h2>' +
        '<button class="btn btn-ghost btn-sm" type="button" id="selToggle">' + (ui.selecting ? 'Batal' : 'Pilih') + '</button></div>' +
      '<div class="grid">';
    store.photos.forEach(function (p, i) {
      const checked = ui.selected.has(p.name);
      html += '<button class="tile" type="button" data-tile="' + i + '"' +
        (ui.selecting ? ' role="checkbox" aria-checked="' + checked + '"' : '') +
        ' aria-label="' + esc(p.label) + '">' +
        '<img src="' + esc(p.url) + '" alt="" loading="lazy"/><span class="chk" aria-hidden="true">&#10003;</span></button>';
    });
    html += '</div></section>';
  }
  html += '</div></div>';
  root.innerHTML = html;
  renderDock();
}

function renderDock() {
  const dock = document.getElementById('dock');
  const total = allItems().length;
  if (ui.selecting) {
    const n = ui.selected.size;
    dock.innerHTML = '<span class="count">' + n + ' dipilih</span>' +
      '<button class="btn btn-primary" type="button" data-save="selected"' + (n ? '' : ' disabled') + '>' + ICON.dl + 'Simpan' + (n ? ' ' + n : '') + '</button>';
    dock.classList.remove('hidden');
  } else if (total > 1) {
    dock.innerHTML = '<button class="btn btn-primary" type="button" data-save="all">' + ICON.dl + 'Simpan semua &middot; ' + total + ' file</button>';
    dock.classList.remove('hidden');
  } else {
    dock.innerHTML = '';
    dock.classList.add('hidden');
  }
}

function toggleTile(i) {
  const photo = store.photos[i];
  if (!photo) return;
  if (ui.selected.has(photo.name)) ui.selected.delete(photo.name);
  else ui.selected.add(photo.name);
  const tile = document.querySelector('[data-tile="' + i + '"]');
  if (tile) tile.setAttribute('aria-checked', ui.selected.has(photo.name) ? 'true' : 'false');
  renderDock();
}

function setSelecting(on) {
  ui.selecting = on;
  ui.selected.clear();
  render(lastFiles);
  const btn = document.getElementById('selToggle');
  if (btn) btn.focus();
}

// One delegated listener: the polling re-renders never stack handlers.
document.addEventListener('click', function (e) {
  let t;
  if ((t = e.target.closest('[data-open]'))) { openViewer(Number(t.dataset.open)); return; }
  if ((t = e.target.closest('[data-tile]'))) {
    const i = Number(t.dataset.tile);
    if (ui.selecting) toggleTile(i);
    else openViewer(viewIndexOf(store.photos[i]));
    return;
  }
  if (e.target.closest('#selToggle')) { setSelecting(!ui.selecting); return; }
  if ((t = e.target.closest('[data-save]'))) {
    if (!t.disabled) saveKey(t.dataset.save, t);
    return;
  }
  if (e.target.closest('[data-sharelink]')) { shareLink(); return; }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (document.getElementById('linkSheet')) closeLinkSheet();
    else closeViewer();
  }
  if (viewerEl && e.key === 'ArrowRight') stepViewer(1);
  if (viewerEl && e.key === 'ArrowLeft') stepViewer(-1);
});

// ---------------------------------------------------------------------------
// Polling: keep the page live while the booth is still uploading, then stop.
// ---------------------------------------------------------------------------
const POLL_MS = 5000;
// With nothing pending, stop once the file list has been quiet this long
// (shorter once the framed print is in; a timed session may still be waiting
// for the guest to arrange it).
const SETTLE_MS = 60000;
const IDLE_STOP_MS = 10 * 60000;
let lastKey = '';

async function poll() {
  const root = document.getElementById('content');
  let res;
  let data;
  try {
    res = await fetch('/api/sessions/' + TOKEN);
    data = await res.json();
  } catch (_e) {
    // Transient network blip — keep polling instead of giving up.
    setTimeout(poll, POLL_MS);
    return;
  }
  if (!res.ok || !data.files || data.exists === false) {
    root.innerHTML = '<div class="gone">Sesi foto ini tidak ditemukan.<br/>Mungkin sudah dihapus. Tanya petugas booth kalau butuh bantuan.</div>';
    document.getElementById('dock').classList.add('hidden');
    return;
  }

  // Refresh the booth's progress signals alongside the file list so the
  // "still generating" indicator tracks the timed flow's arrange→generate
  // lifecycle even when no file is being added right now.
  const signals = await Promise.all([fetchJson('print-request.json'), fetchJson('print-result.json')]);
  CONTROL.printRequest = signals[0];
  CONTROL.printResult = signals[1];

  const key = data.files
    .map(function (f) { return f.name + ':' + f.size; })
    .sort()
    .join(',');
  const wasBusy = pendingNote(lastFiles) === 'busy';
  if (key !== lastKey) {
    lastKey = key;
    changeCount += 1;
    lastChangeAt = Date.now();
    render(data.files);
  } else if (wasBusy !== (pendingNote(data.files) === 'busy')) {
    render(data.files);
  } else {
    renderNote();
  }

  const quiet = Date.now() - lastChangeAt;
  const settled = data.files.length > 0 && pendingNote(data.files) === null &&
    ((store.framed && quiet > SETTLE_MS) || quiet > IDLE_STOP_MS);
  if (!settled) setTimeout(poll, POLL_MS);
}

// Print status (sessions.print_status via the Worker). Polled until final.
const PRINT_LABELS = {
  success: ['ok', '\\u2713 Sudah dicetak'],
  printing: ['', 'Sedang dicetak\\u2026'],
  queued: ['', 'Menunggu antrean cetak'],
  ready_to_print: ['', 'Menunggu antrean cetak'],
  error: ['err', 'Gagal dicetak, hubungi petugas'],
};
function pollPrint() {
  fetch('/api/sessions/' + TOKEN + '/print')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      const pill = document.getElementById('printPill');
      const label = data && PRINT_LABELS[data.print_status];
      if (pill) {
        pill.className = 'gprint' + (label && label[0] ? ' ' + label[0] : '');
        pill.textContent = label ? label[1] : '';
      }
      if (!data || data.print_status !== 'success') setTimeout(pollPrint, 8000);
    })
    .catch(function () { setTimeout(pollPrint, 8000); });
}

document.getElementById('timeText').textContent = CREATED_AT ? formatDate(CREATED_AT, true) : '';
poll();
pollPrint();
</script>
</body>
</html>`;
};
