import { themeTokenCssVars, type BoothTheme } from '@photo-booth/types';

/** Kelana mark on a white tile (same as the booth favicon), inlined so the worker serves no extra file. */
const KELANA_FAVICON = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201200%201200%22%20role%3D%22img%22%20aria-label%3D%22Kelana%22%3E%3Crect%20width%3D%221200%22%20height%3D%221200%22%20rx%3D%22264%22%20fill%3D%22%23FFFFFF%22%2F%3E%3Cg%20transform%3D%22translate(81.7%20265.9)%20scale(0.8711)%22%3E%3Cpath%20fill%3D%22%23515543%22%20d%3D%22M%20281.5%20318.7%20C%20278.6%20319%2C%20256.3%20322.7%2C%20230.5%20327.1%20C%20223.9%20328.3%2C%20214.9%20329.6%2C%20210.5%20330.1%20C%20199.3%20331.4%2C%20191.6%20332.6%2C%20183.5%20334.4%20C%20179.7%20335.2%2C%20172.2%20336.4%2C%20167%20337%20C%20161.8%20337.6%2C%20153.3%20339%2C%20148.3%20340.1%20C%20143.2%20341.1%2C%20135.9%20342.4%2C%20132.1%20343%20C%20119.8%20344.7%2C%20117.2%20347.5%2C%20118.3%20357.3%20C%20119.3%20365.2%2C%20122.3%20367.5%2C%20131%20366.6%20C%20148.5%20364.8%2C%20188.6%20362%2C%20210%20361%20C%20220.2%20360.5%2C%20238.2%20359.2%2C%20250%20358%20C%20261.8%20356.9%2C%20275.3%20355.7%2C%20280%20355.4%20C%20295%20354.4%2C%20299.3%20351.6%2C%20306%20338.3%20C%20314%20322.7%2C%20305.3%20315.7%2C%20281.5%20318.7%20M%20236%20436.6%20C%20227.5%20437.3%2C%20209.7%20439.3%2C%20196.5%20440.9%20C%20183.3%20442.6%2C%20169.8%20444.2%2C%20166.5%20444.5%20C%20163.2%20444.9%2C%20156.5%20446%2C%20151.5%20447%20C%20146.6%20448%2C%20139.4%20449.1%2C%20135.5%20449.5%20C%20131.7%20449.9%2C%20123.8%20451.3%2C%20118%20452.6%20C%20112.2%20453.8%2C%20102.9%20455.6%2C%2097.2%20456.4%20C%2091.6%20457.3%2C%2084.4%20458.6%2C%2081.2%20459.4%20C%2078.1%20460.2%2C%2071.5%20461.4%2C%2066.5%20462%20C%2049.5%20464.1%2C%2043.6%20469.4%2C%2048.7%20478.1%20C%2051.8%20483.4%2C%2053.5%20483.6%2C%2083.9%20481.7%20C%2099.1%20480.7%2C%20115.9%20480%2C%20121.3%20480%20C%20126.7%20480%2C%20134.1%20479.6%2C%20137.8%20479%20C%20149.7%20477.3%2C%20180.9%20474.9%2C%20203.5%20474%20C%20215.6%20473.6%2C%20226.2%20472.9%2C%20227%20472.6%20C%20227.8%20472.3%2C%20236.2%20471.4%2C%20245.5%20470.5%20C%20265.8%20468.7%2C%20271.7%20467.2%2C%20277.2%20462.2%20C%20285.5%20454.7%2C%20285.3%20448.1%2C%20276.3%20441.3%20C%20269.1%20435.9%2C%20258.2%20434.6%2C%20236%20436.6%20M%20259.5%20551.6%20C%20256.2%20552.3%2C%20248.6%20553.7%2C%20242.5%20554.5%20C%20236.5%20555.4%2C%20225.9%20557.2%2C%20219%20558.6%20C%20212.1%20559.9%2C%20202.7%20561.5%2C%20198%20562.1%20C%20193.3%20562.6%2C%20184.1%20564.2%2C%20177.5%20565.5%20C%20170.9%20566.8%2C%20162.6%20568.1%2C%20159%20568.5%20C%20155.4%20568.9%2C%20149.1%20570%2C%20145%20571%20C%20140.9%20572.1%2C%20133.5%20573.4%2C%20128.5%20574%20C%20114.3%20575.7%2C%20111.2%20579.9%2C%20118.3%20587.6%20L%20121.6%20591.2%20135.6%20592.6%20C%20174.2%20596.3%2C%20213.6%20592.3%2C%20239.8%20581.9%20C%20265.9%20571.5%2C%20281.6%20556.1%2C%20270.5%20551.4%20C%20266.5%20549.8%2C%20267.2%20549.8%2C%20259.5%20551.6%22%2F%3E%3Cpath%20fill%3D%22%23537796%22%20fill-rule%3D%22evenodd%22%20d%3D%22M%20848%2037.7%20C%20766.2%2045.8%2C%20733.2%2068.9%2C%20671.9%20160.8%20C%20661.5%20176.3%2C%20652.2%20190.3%2C%20651.1%20191.8%20C%20640.6%20206.6%2C%20618.8%20241%2C%20617.9%20244.1%20C%20616.8%20247.6%2C%20616.9%20248.4%2C%20618.7%20250.8%20C%20621.3%20254.4%2C%20622.4%20254.7%2C%20658.5%20261.6%20C%20668.1%20263.5%2C%20688.8%20267.9%2C%20706%20271.7%20C%20725.8%20276.1%2C%20754.2%20275.8%2C%20768.5%20271.1%20C%20791.5%20263.4%2C%20798%20258.7%2C%20827.4%20228.1%20C%20847.8%20206.8%2C%20861.5%20191.3%2C%20870%20180%20C%20884.8%20160.3%2C%20897.7%20143.2%2C%20900.6%20139.5%20C%20916.3%20119%2C%20937.3%2088.7%2C%20940.2%2082.3%20C%20946.8%2067.3%2C%20943.4%2053.5%2C%20931.4%2046.8%20C%20922.3%2041.7%2C%20867.6%2035.7%2C%20848%2037.7%20M%20475.3%2074.1%20C%20468.6%2074.6%2C%20458.7%2075.9%2C%20453.3%2077%20C%20447.9%2078.2%2C%20440%2079.8%2C%20435.7%2080.6%20C%20397.7%2087.9%2C%20367.6%20108.9%2C%20353.9%20137.5%20C%20345.2%20155.6%2C%20342.2%20170.3%2C%20340%20204.5%20C%20339.4%20213.9%2C%20338.3%20227.1%2C%20337.5%20234%20C%20336.8%20240.9%2C%20335.9%20257.1%2C%20335.6%20270%20C%20335.1%20294.5%2C%20333.6%20321.1%2C%20331.9%20336.5%20C%20331.3%20341.5%2C%20330.5%20358.8%2C%20330%20375%20C%20329.6%20391.2%2C%20328.7%20413.7%2C%20328%20425%20C%20326%20460.2%2C%20327.1%20647.2%2C%20329.3%20657.8%20C%20336.7%20692.2%2C%20356.4%20712.2%2C%20388.9%20718.1%20C%20432.8%20726.1%2C%20509.7%20725.5%2C%20534.6%20717%20C%20550.9%20711.4%2C%20559.4%20700.5%2C%20562.1%20681.7%20C%20563.2%20673.6%2C%20561.8%20643.3%2C%20559.5%20626.5%20C%20558.7%20621%2C%20557.4%20609.1%2C%20556.5%20600%20C%20554.8%20581.9%2C%20550.7%20549.2%2C%20548.5%20536.3%20C%20545.6%20518.8%2C%20537.8%20508.6%2C%20518.5%20497.2%20C%20501.1%20487%2C%20489.4%20475.9%2C%20479.3%20460.4%20C%20464.3%20437.1%2C%20458.2%20397.6%2C%20464.8%20366.6%20C%20472.4%20331.2%2C%20491.1%20305%2C%20522%20286.5%20C%20531.1%20281%2C%20544%20268.3%2C%20547.2%20261.8%20C%20550%20256.1%2C%20553.1%20242.9%2C%20555%20229%20C%20555.7%20224.3%2C%20557.2%20215.8%2C%20558.5%20210%20C%20559.8%20204.2%2C%20561.6%20193.4%2C%20562.5%20186%20C%20563.4%20178.6%2C%20564.8%20169.6%2C%20565.5%20166%20C%20566.2%20162.4%2C%20567.1%20156.1%2C%20567.5%20152%20C%20567.8%20147.9%2C%20568.8%20139.4%2C%20569.7%20133.2%20C%20573.7%20103.8%2C%20567.7%2086.2%2C%20550.6%2078%20C%20541.2%2073.5%2C%20508.8%2071.8%2C%20475.3%2074.1%20M%20602%20282.9%20C%20569.2%20287.6%2C%20536.7%20310.7%2C%20522.3%20339.5%20C%20501%20381.9%2C%20511.1%20441.4%2C%20544.1%20468.8%20C%20557.2%20479.7%2C%20577%20490.1%2C%20590.1%20493%20C%20593.7%20493.8%2C%20601.1%20494.1%2C%20611.5%20493.8%20C%20629.3%20493.3%2C%20636.3%20491.4%2C%20654.5%20482.2%20C%20698.5%20460.1%2C%20720.9%20408.8%2C%20708.4%20359%20C%20697%20313.5%2C%20645.5%20276.7%2C%20602%20282.9%20M%20591.5%20315.5%20C%20564%20322.9%2C%20543%20347.4%2C%20543%20372.1%20C%20543%20388.1%2C%20552.8%20388.4%2C%20563.4%20372.6%20C%20573.4%20357.7%2C%20584.1%20349.5%2C%20602.4%20342.6%20C%20610.6%20339.5%2C%20613.7%20337.4%2C%20615.6%20333.9%20C%20621.9%20321.7%2C%20608%20311%2C%20591.5%20315.5%20M%20763.5%20460.1%20C%20748.8%20462%2C%20741.1%20465.4%2C%20700%20487.2%20C%20686%20494.6%2C%20665.1%20505.5%2C%20653.5%20511.4%20C%20614.7%20531.1%2C%20614.8%20530.9%2C%20630.4%20552.5%20C%20642.3%20569%2C%20653.4%20585.4%2C%20662%20599.1%20C%20674.9%20619.8%2C%20693%20646.6%2C%20699.6%20655%20C%20702.9%20659.1%2C%20707.1%20664.8%2C%20709%20667.5%20C%20720.8%20684.9%2C%20742%20704.7%2C%20760%20715.3%20C%20766.6%20719.1%2C%20784%20724.6%2C%20795.9%20726.6%20C%20820.2%20730.6%2C%20848.3%20724.9%2C%20877.8%20710.1%20C%20900.4%20698.8%2C%20927.8%20676.2%2C%20943.6%20656%20C%20946.8%20651.9%2C%20953.2%20644.3%2C%20957.7%20639.2%20C%20983.8%20609.7%2C%20987.2%20592.7%2C%20970.1%20576.7%20C%20965.3%20572.2%2C%20952.1%20563.3%2C%20912.8%20538%20C%20897.9%20528.4%2C%20855.4%20499.8%2C%20827.8%20480.7%20C%20803.3%20463.8%2C%20783.5%20457.4%2C%20763.5%20460.1%22%2F%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M%20595.5%20314.6%20C%20579.6%20318.6%2C%20569.7%20324.2%2C%20559.9%20334.8%20C%20546.6%20349.1%2C%20539.4%20370.2%2C%20544.5%20380%20C%20548.4%20387.4%2C%20555.1%20384.6%2C%20563.6%20371.9%20C%20572.9%20357.9%2C%20586.4%20347.8%2C%20604.5%20341.4%20C%20611.3%20339%2C%20617%20333.3%2C%20617%20328.9%20C%20617%20319.9%2C%20605.3%20312.2%2C%20595.5%20314.6%22%2F%3E%3Cpath%20fill%3D%22%23CFAD63%22%20d%3D%22M%20868.6%20273.5%20C%20854.1%20309.2%2C%20826.9%20340.2%2C%20793.7%20358.9%20L%20787.9%20362.2%20799%20368.8%20C%20830.3%20387.5%2C%20854.5%20416.5%2C%20869.6%20453.3%20L%20872.9%20461.5%20874.5%20457.5%20C%20891.7%20415.7%2C%20914.1%20388.4%2C%20947.8%20368.3%20L%20958.2%20362.2%20949.7%20357.5%20C%20928.8%20345.8%2C%20909.2%20327.4%2C%20894.8%20306%20C%20888%20295.9%2C%20875.8%20272.4%2C%20874.5%20266.8%20C%20873.4%20262.5%2C%20872.8%20263.3%2C%20868.6%20273.5%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E';

/** Kelana logo (light variant for the dark gallery chrome). */
const KELANA_LOGO_SVG = "<svg class=\"contact-logo\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"37 27 2532 711\" role=\"img\" aria-label=\"Kelana\"><path fill=\"#C3C8AE\" d=\"M 281.5 318.7 C 278.6 319, 256.3 322.7, 230.5 327.1 C 223.9 328.3, 214.9 329.6, 210.5 330.1 C 199.3 331.4, 191.6 332.6, 183.5 334.4 C 179.7 335.2, 172.2 336.4, 167 337 C 161.8 337.6, 153.3 339, 148.3 340.1 C 143.2 341.1, 135.9 342.4, 132.1 343 C 119.8 344.7, 117.2 347.5, 118.3 357.3 C 119.3 365.2, 122.3 367.5, 131 366.6 C 148.5 364.8, 188.6 362, 210 361 C 220.2 360.5, 238.2 359.2, 250 358 C 261.8 356.9, 275.3 355.7, 280 355.4 C 295 354.4, 299.3 351.6, 306 338.3 C 314 322.7, 305.3 315.7, 281.5 318.7 M 236 436.6 C 227.5 437.3, 209.7 439.3, 196.5 440.9 C 183.3 442.6, 169.8 444.2, 166.5 444.5 C 163.2 444.9, 156.5 446, 151.5 447 C 146.6 448, 139.4 449.1, 135.5 449.5 C 131.7 449.9, 123.8 451.3, 118 452.6 C 112.2 453.8, 102.9 455.6, 97.2 456.4 C 91.6 457.3, 84.4 458.6, 81.2 459.4 C 78.1 460.2, 71.5 461.4, 66.5 462 C 49.5 464.1, 43.6 469.4, 48.7 478.1 C 51.8 483.4, 53.5 483.6, 83.9 481.7 C 99.1 480.7, 115.9 480, 121.3 480 C 126.7 480, 134.1 479.6, 137.8 479 C 149.7 477.3, 180.9 474.9, 203.5 474 C 215.6 473.6, 226.2 472.9, 227 472.6 C 227.8 472.3, 236.2 471.4, 245.5 470.5 C 265.8 468.7, 271.7 467.2, 277.2 462.2 C 285.5 454.7, 285.3 448.1, 276.3 441.3 C 269.1 435.9, 258.2 434.6, 236 436.6 M 259.5 551.6 C 256.2 552.3, 248.6 553.7, 242.5 554.5 C 236.5 555.4, 225.9 557.2, 219 558.6 C 212.1 559.9, 202.7 561.5, 198 562.1 C 193.3 562.6, 184.1 564.2, 177.5 565.5 C 170.9 566.8, 162.6 568.1, 159 568.5 C 155.4 568.9, 149.1 570, 145 571 C 140.9 572.1, 133.5 573.4, 128.5 574 C 114.3 575.7, 111.2 579.9, 118.3 587.6 L 121.6 591.2 135.6 592.6 C 174.2 596.3, 213.6 592.3, 239.8 581.9 C 265.9 571.5, 281.6 556.1, 270.5 551.4 C 266.5 549.8, 267.2 549.8, 259.5 551.6\"/><path fill=\"#7FA2C2\" fill-rule=\"evenodd\" d=\"M 848 37.7 C 766.2 45.8, 733.2 68.9, 671.9 160.8 C 661.5 176.3, 652.2 190.3, 651.1 191.8 C 640.6 206.6, 618.8 241, 617.9 244.1 C 616.8 247.6, 616.9 248.4, 618.7 250.8 C 621.3 254.4, 622.4 254.7, 658.5 261.6 C 668.1 263.5, 688.8 267.9, 706 271.7 C 725.8 276.1, 754.2 275.8, 768.5 271.1 C 791.5 263.4, 798 258.7, 827.4 228.1 C 847.8 206.8, 861.5 191.3, 870 180 C 884.8 160.3, 897.7 143.2, 900.6 139.5 C 916.3 119, 937.3 88.7, 940.2 82.3 C 946.8 67.3, 943.4 53.5, 931.4 46.8 C 922.3 41.7, 867.6 35.7, 848 37.7 M 475.3 74.1 C 468.6 74.6, 458.7 75.9, 453.3 77 C 447.9 78.2, 440 79.8, 435.7 80.6 C 397.7 87.9, 367.6 108.9, 353.9 137.5 C 345.2 155.6, 342.2 170.3, 340 204.5 C 339.4 213.9, 338.3 227.1, 337.5 234 C 336.8 240.9, 335.9 257.1, 335.6 270 C 335.1 294.5, 333.6 321.1, 331.9 336.5 C 331.3 341.5, 330.5 358.8, 330 375 C 329.6 391.2, 328.7 413.7, 328 425 C 326 460.2, 327.1 647.2, 329.3 657.8 C 336.7 692.2, 356.4 712.2, 388.9 718.1 C 432.8 726.1, 509.7 725.5, 534.6 717 C 550.9 711.4, 559.4 700.5, 562.1 681.7 C 563.2 673.6, 561.8 643.3, 559.5 626.5 C 558.7 621, 557.4 609.1, 556.5 600 C 554.8 581.9, 550.7 549.2, 548.5 536.3 C 545.6 518.8, 537.8 508.6, 518.5 497.2 C 501.1 487, 489.4 475.9, 479.3 460.4 C 464.3 437.1, 458.2 397.6, 464.8 366.6 C 472.4 331.2, 491.1 305, 522 286.5 C 531.1 281, 544 268.3, 547.2 261.8 C 550 256.1, 553.1 242.9, 555 229 C 555.7 224.3, 557.2 215.8, 558.5 210 C 559.8 204.2, 561.6 193.4, 562.5 186 C 563.4 178.6, 564.8 169.6, 565.5 166 C 566.2 162.4, 567.1 156.1, 567.5 152 C 567.8 147.9, 568.8 139.4, 569.7 133.2 C 573.7 103.8, 567.7 86.2, 550.6 78 C 541.2 73.5, 508.8 71.8, 475.3 74.1 M 602 282.9 C 569.2 287.6, 536.7 310.7, 522.3 339.5 C 501 381.9, 511.1 441.4, 544.1 468.8 C 557.2 479.7, 577 490.1, 590.1 493 C 593.7 493.8, 601.1 494.1, 611.5 493.8 C 629.3 493.3, 636.3 491.4, 654.5 482.2 C 698.5 460.1, 720.9 408.8, 708.4 359 C 697 313.5, 645.5 276.7, 602 282.9 M 591.5 315.5 C 564 322.9, 543 347.4, 543 372.1 C 543 388.1, 552.8 388.4, 563.4 372.6 C 573.4 357.7, 584.1 349.5, 602.4 342.6 C 610.6 339.5, 613.7 337.4, 615.6 333.9 C 621.9 321.7, 608 311, 591.5 315.5 M 763.5 460.1 C 748.8 462, 741.1 465.4, 700 487.2 C 686 494.6, 665.1 505.5, 653.5 511.4 C 614.7 531.1, 614.8 530.9, 630.4 552.5 C 642.3 569, 653.4 585.4, 662 599.1 C 674.9 619.8, 693 646.6, 699.6 655 C 702.9 659.1, 707.1 664.8, 709 667.5 C 720.8 684.9, 742 704.7, 760 715.3 C 766.6 719.1, 784 724.6, 795.9 726.6 C 820.2 730.6, 848.3 724.9, 877.8 710.1 C 900.4 698.8, 927.8 676.2, 943.6 656 C 946.8 651.9, 953.2 644.3, 957.7 639.2 C 983.8 609.7, 987.2 592.7, 970.1 576.7 C 965.3 572.2, 952.1 563.3, 912.8 538 C 897.9 528.4, 855.4 499.8, 827.8 480.7 C 803.3 463.8, 783.5 457.4, 763.5 460.1\"/><path fill=\"#FFFFFF\" d=\"M 595.5 314.6 C 579.6 318.6, 569.7 324.2, 559.9 334.8 C 546.6 349.1, 539.4 370.2, 544.5 380 C 548.4 387.4, 555.1 384.6, 563.6 371.9 C 572.9 357.9, 586.4 347.8, 604.5 341.4 C 611.3 339, 617 333.3, 617 328.9 C 617 319.9, 605.3 312.2, 595.5 314.6\"/><path fill=\"#D9B96F\" d=\"M 868.6 273.5 C 854.1 309.2, 826.9 340.2, 793.7 358.9 L 787.9 362.2 799 368.8 C 830.3 387.5, 854.5 416.5, 869.6 453.3 L 872.9 461.5 874.5 457.5 C 891.7 415.7, 914.1 388.4, 947.8 368.3 L 958.2 362.2 949.7 357.5 C 928.8 345.8, 909.2 327.4, 894.8 306 C 888 295.9, 875.8 272.4, 874.5 266.8 C 873.4 262.5, 872.8 263.3, 868.6 273.5\"/><path fill=\"#F3EADF\" d=\"M1180.9 738.4Q1106.3 738.4 1064.3 699.2Q1022.4 660.1 1022.4 585.0L1022.4 585.0Q1022.4 510.0 1064.3 470.9Q1106.3 431.8 1180.9 431.8L1180.9 431.8Q1254.9 431.8 1287.7 470.3Q1320.5 508.9 1320.5 566.2L1320.5 566.2L1320.5 604.0L1150.5 604.0L1150.5 607.1Q1150.5 626.5 1162 635.7Q1173.5 644.9 1200.3 644.9L1200.3 644.9Q1232.3 644.9 1261.2 640.2Q1290.1 635.5 1311.6 628.1L1311.6 628.1L1311.6 712.1Q1293.3 722.1 1257.8 730.2Q1222.4 738.4 1180.9 738.4L1180.9 738.4ZM1150.5 546.2L1211.3 546.2L1211.3 539.9Q1211.3 522.1 1203.7 514.2Q1196.1 506.3 1180.9 506.3L1180.9 506.3Q1165.7 506.3 1158.1 514.4Q1150.5 522.6 1150.5 539.9L1150.5 539.9L1150.5 546.2ZM1513.8 731.5L1346.8 731.5L1346.8 644.9L1369.9 644.9L1369.9 408.7L1346.8 408.7L1346.8 322.6L1490.6 322.6L1490.6 644.9L1513.8 644.9L1513.8 731.5ZM1824.0 644.9L1847.1 644.9L1847.1 731L1708.5 731L1708.5 695.3Q1697.0 712.1 1676.2 725.2Q1655.5 738.4 1625.6 738.4L1625.6 738.4Q1586.2 738.4 1563.6 717.4Q1541.0 696.4 1541.0 658.0L1541.0 658.0Q1541.0 558.8 1709.6 556.2L1709.6 556.2Q1708 538.3 1695.9 531.8Q1683.8 525.2 1655.0 525.2L1655.0 525.2Q1631.3 525.2 1604.3 530.2Q1577.3 535.2 1554.7 543.6L1554.7 543.6L1554.7 447.0Q1582.5 440.2 1615.1 436.0Q1647.6 431.8 1678.6 431.8L1678.6 431.8Q1756.8 431.8 1790.4 460.1Q1824.0 488.5 1824.0 547.8L1824.0 547.8L1824.0 644.9ZM1708.5 611.3L1708.5 608.1Q1684.9 608.1 1672.0 614.5Q1659.2 620.8 1659.2 635.5L1659.2 635.5Q1659.2 644.4 1664.7 649.9Q1670.2 655.4 1680.2 655.4L1680.2 655.4Q1693.8 655.4 1701.2 643.9Q1708.5 632.3 1708.5 611.3L1708.5 611.3ZM2199.9 644.9L2223.0 644.9L2223.0 731L2057.1 731L2057.1 644.9L2079.2 644.9L2079.2 558.8Q2079.2 541.5 2071.8 533.3Q2064.5 525.2 2049.8 525.2L2049.8 525.2Q2018.3 525.2 2018.3 558.8L2018.3 558.8L2018.3 644.9L2040.3 644.9L2040.3 731L1874.4 731L1874.4 644.9L1897.5 644.9L1897.5 525.2L1874.4 525.2L1874.4 439.1L2018.3 439.1L2018.3 480.1Q2056.1 431.8 2112.8 431.8L2112.8 431.8Q2156.3 431.8 2178.1 459.1Q2199.9 486.4 2199.9 534.1L2199.9 534.1L2199.9 644.9ZM2533.3 644.9L2556.4 644.9L2556.4 731L2417.8 731L2417.8 695.3Q2406.3 712.1 2385.5 725.2Q2364.8 738.4 2334.8 738.4L2334.8 738.4Q2295.5 738.4 2272.9 717.4Q2250.3 696.4 2250.3 658.0L2250.3 658.0Q2250.3 558.8 2418.8 556.2L2418.8 556.2Q2417.3 538.3 2405.2 531.8Q2393.1 525.2 2364.3 525.2L2364.3 525.2Q2340.6 525.2 2313.6 530.2Q2286.6 535.2 2264.0 543.6L2264.0 543.6L2264.0 447.0Q2291.8 440.2 2324.3 436.0Q2356.9 431.8 2387.9 431.8L2387.9 431.8Q2466.1 431.8 2499.7 460.1Q2533.3 488.5 2533.3 547.8L2533.3 547.8L2533.3 644.9ZM2417.8 611.3L2417.8 608.1Q2394.2 608.1 2381.3 614.5Q2368.4 620.8 2368.4 635.5L2368.4 635.5Q2368.4 644.4 2374.0 649.9Q2379.5 655.4 2389.4 655.4L2389.4 655.4Q2403.1 655.4 2410.4 643.9Q2417.8 632.3 2417.8 611.3L2417.8 611.3Z\"/></svg>";

/** Contact for bookings, shown under every gallery. */
const KELANA_INSTAGRAM = 'https://www.instagram.com/kelanacirebon_';
const KELANA_WHATSAPP =
  'https://wa.me/6285287560280?text=' +
  encodeURIComponent('Halo Kelana! Saya lihat hasil photobooth-nya dan tertarik sewa photobooth untuk acara saya.');

/**
 * Self-contained gallery page served at GET /p/:token.
 * It fetches the session file list from the Worker and renders the framed
 * photo, the animated GIF, and the original photos in a layout modeled on the
 * admin "Session results" view: a header with QR / title / token / timestamp,
 * then framed outputs on the left and the photo grid on the right, with
 * download-all and per-photo selection. No external CDNs.
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
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Hasil Foto Mu · Kelana</title>
<link rel="icon" type="image/svg+xml" href="${KELANA_FAVICON}"/>
<style>
  :root { ${themeVars} --pink:var(--pbx-ui-brand); --pink-fg:var(--pbx-ui-brand-fg); --purple:var(--pbx-ui-secondary); --dark:var(--pbx-ui-panel); --lime:var(--pbx-ui-hi); --panel:var(--pbx-ui-raised); --card:var(--pbx-ui-raised); }
  * { box-sizing:border-box; }
  html, body { margin:0; }
  body {
    min-height:100vh; color:#fff;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background:
      radial-gradient(1100px 520px at 50% -10%, rgb(var(--pbx-ui-secondary-rgb) / .28), transparent 60%),
      linear-gradient(180deg,var(--pbx-ui-bg) 0%, var(--pbx-ui-panel) 55%, var(--pbx-ui-raised-2) 100%);
  }
  .wrap { max-width:1152px; margin:0 auto; padding:0 18px 72px; }

  /* Header — mirrors the admin results modal header (QR + title + token). */
  .ghead { display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:20px 0 16px; border-bottom:1px solid rgba(255,255,255,.1); }
  .ghead-left { display:flex; align-items:center; gap:16px; min-width:0; }
  .gqr { width:64px; height:64px; border-radius:12px; background:#fff; padding:4px; flex-shrink:0; border:0; cursor:pointer; }
  .gqr:hover { transform:scale(1.05); }
  .gqr img { width:100%; height:100%; display:block; }
  .gqr.ph { display:grid; place-items:center; }
  .gqr.ph svg { width:30px; height:30px; opacity:.4; color:#fff; }
  .gtitles { min-width:0; }
  .gtitle { margin:0; font-size:1.3rem; font-weight:800; letter-spacing:-0.01em; }
  .gsub { margin:3px 0 0; font-size:.72rem; color:rgba(255,255,255,.55); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gsub .sep { padding:0 7px; }

  /* All-time/download controls (top-right of header, admin-style). */
  .ghead-right { margin-left:auto; display:flex; align-items:center; gap:10px; }

  /* Two-column layout: framed outputs (1/3) + photos (2/3). */
  .grid3 { display:grid; grid-template-columns:1fr; gap:28px; margin-top:26px; align-items:start; }
  @media (min-width:1024px){ .grid3 { grid-template-columns:1fr 2fr; gap:36px; } }
  .col-side { display:grid; gap:28px; align-content:start; min-width:0; }

  .card { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:18px; padding:16px; }
  .card h4 { display:flex; align-items:center; gap:7px; font-size:.78rem; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:rgba(255,255,255,.6); margin:0 0 12px; }
  .card h4 svg { width:16px; height:16px; flex-shrink:0; }
  .res { position:relative; display:block; overflow:hidden; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:var(--card); cursor:pointer; border:0; padding:0; width:100%; }
  .res.sq { aspect-ratio:1/1; background:rgba(0,0,0,.3); padding:10px; }
  .res.sq img { width:100%; height:100%; object-fit:contain; }
  .res img { width:100%; height:100%; display:block; transition:transform .15s ease; }
  .res:hover img { transform:scale(1.03); }
  .res .cap { position:absolute; left:0; right:0; bottom:0; display:flex; align-items:center; gap:6px; background:rgba(0,0,0,.7); padding:6px 9px; font-size:.76rem; font-weight:700; color:rgba(255,255,255,.92); text-align:left; }
  .res .cap svg { width:15px; height:15px; flex-shrink:0; }

  /* Photos column. */
  .col-main { min-width:0; }
  .ph-head { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
  .ph-head h4 { display:flex; align-items:center; gap:7px; font-size:.78rem; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:rgb(var(--pbx-ui-hi-rgb) / .9); margin:0; }
  .ph-head h4 svg { width:16px; height:16px; }
  .ph-head .hint { font-size:.72rem; color:rgba(255,255,255,.5); }
  .pgrid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
  @media (min-width:640px){ .pgrid { grid-template-columns:repeat(3,1fr); } }
  @media (min-width:1150px){ .pgrid { grid-template-columns:repeat(4,1fr); } }
  .tile { position:relative; aspect-ratio:1/1; overflow:hidden; border:3px solid transparent; border-radius:12px; background:#000; cursor:pointer; }
  .tile img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .15s ease; }
  .tile:hover img { transform:scale(1.04); }
  .tile.sel { border-color:var(--pink); }
  .tile.sel img { opacity:.85; }
  .tile .badge { position:absolute; top:8px; left:8px; width:24px; height:24px; border-radius:50%; background:var(--pink); color:var(--pink-fg); display:none; align-items:center; justify-content:center; font-size:12px; font-weight:900; z-index:2; }
  .tile.sel .badge { display:flex; }
  .eye { position:absolute; top:8px; right:8px; width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,.55); color:#fff; display:flex; align-items:center; justify-content:center; border:2px solid rgba(255,255,255,.35); cursor:pointer; z-index:2; opacity:.85; transition:opacity .15s, transform .15s; }
  .eye:hover { transform:scale(1.1); opacity:1; }
  .eye svg { width:18px; height:18px; display:block; }

  .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; align-items:center; }
  .count { font-size:.78rem; font-weight:800; opacity:.9; margin-left:auto; }
  .btn { display:inline-flex; align-items:center; justify-content:center; background:var(--pink); color:var(--pink-fg); font-weight:900; padding:10px 20px; border-radius:999px; text-decoration:none; font-size:.86rem; border:none; cursor:pointer; }
  .btn.sm { padding:7px 14px; font-size:.76rem; }
  .btn.ghost { background:rgba(255,255,255,.14); }
  .btn:disabled { opacity:.55; cursor:not-allowed; }
  .hidden { display:none !important; }

  /* "Outputs still being generated/uploaded" indicator. */
  .note { margin-top:26px; display:flex; gap:10px; align-items:center; justify-content:center; text-align:center; background:rgb(var(--pbx-ui-hi-rgb) / .12); border:2px solid rgb(var(--pbx-ui-hi-rgb) / .5); border-radius:14px; padding:12px 16px; font-size:.9rem; font-weight:800; color:var(--lime); }
  .note.err { background:rgba(255,94,135,.12); border-color:rgba(255,94,135,.55); color:#ffd0e8; }
  .note .spin { display:inline-block; width:14px; height:14px; border:2px solid rgb(var(--pbx-ui-hi-rgb) / .4); border-top-color:var(--lime); border-radius:50%; animation:spin 1s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }

  .status { text-align:center; padding:70px 0; opacity:.85; }
  .err { text-align:center; color:#ffd0e8; padding:70px 20px; font-weight:700; }
  @keyframes pulse { 50% { opacity:.35; } }
  .pulse { animation: pulse 1.2s ease-in-out infinite; }

  /* Fullscreen image viewer — keep the existing tap-to-enlarge modal. */
  .viewer { position:fixed; inset:0; z-index:50; background:rgb(var(--pbx-ui-bg-rgb) / .96); display:flex; align-items:center; justify-content:center; padding:24px; }
  .viewer img { max-width:92vw; max-height:78vh; width:auto; height:auto; border-radius:10px; background:#fff; box-shadow:0 12px 40px rgba(0,0,0,.55); }
  .viewer img.square { border-radius:0; }
  .viewer-close { position:absolute; top:16px; right:16px; width:46px; height:46px; border-radius:50%; border:none; background:var(--pink); color:var(--pink-fg); font-size:1.25rem; font-weight:900; cursor:pointer; box-shadow:0 3px 10px rgba(0,0,0,.35); }
  .viewer-close:hover { transform:scale(1.08); }
  .viewer-bar { position:absolute; left:0; right:0; bottom:0; padding:18px 24px 22px; display:flex; align-items:center; justify-content:center; gap:14px; background:linear-gradient(0deg, rgb(var(--pbx-ui-bg-rgb) / .9), transparent); }
  .viewer-bar .name { font-size:.82rem; font-weight:700; opacity:.9; max-width:50%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .viewer .btn { margin-top:0; }

  /* Enlarged QR modal. */
  .qrmodal { position:fixed; inset:0; z-index:60; background:rgb(var(--pbx-ui-panel-rgb) / .95); display:none; align-items:center; justify-content:center; padding:20px; }
  .qrmodal.open { display:flex; }
  .qrmodal-box { width:min(360px,92vw); background:#fff; border:4px solid var(--pink); border-radius:18px; padding:22px; display:flex; flex-direction:column; align-items:center; gap:14px; animation:zoom .28s cubic-bezier(.2,.9,.3,1.2) both; }
  .qrmodal-box h2 { margin:0; font-size:.82rem; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--pbx-ink); text-align:center; }
  .qrmodal-box img { width:min(280px,70vw); height:auto; border-radius:12px; }
  .qrmodal-box p { margin:0; max-width:100%; overflow-wrap:anywhere; font-size:.62rem; font-weight:700; color:var(--pbx-ink); text-align:center; }
  .qrmodal-box .btn { margin-top:2px; }
  @keyframes zoom { from { transform:scale(.85); opacity:0; } to { transform:scale(1); opacity:1; } }

  .contact { margin:44px auto 0; max-width:640px; text-align:center; padding:26px 22px 24px; border-radius:20px; background:var(--panel); border:1px solid rgba(255,255,255,.1); }
  .contact-logo { display:block; height:44px; width:auto; margin:0 auto 14px; }
  .contact h2 { margin:0 0 6px; font-size:1.15rem; font-weight:900; }
  .contact p { margin:0 auto 18px; max-width:460px; font-size:.9rem; line-height:1.5; opacity:.8; }
  .contact-actions { display:flex; flex-wrap:wrap; justify-content:center; gap:10px; }
  .contact-btn { display:inline-flex; align-items:center; gap:8px; padding:12px 18px; border-radius:999px; font-weight:800; font-size:.9rem; text-decoration:none; transition:transform .15s ease; }
  .contact-btn:hover { transform:translateY(-1px); }
  .contact-btn svg { width:20px; height:20px; flex-shrink:0; }
  .contact-wa { background:#25D366; color:#073B1C; }
  .contact-ig { background:linear-gradient(45deg,#F58529,#DD2A7B 55%,#8134AF); color:#fff; }
  footer { text-align:center; margin-top:28px; opacity:.55; font-size:.8rem; }
</style>
</head>
<body>
<div class="wrap">
  <header class="ghead">
    <div class="ghead-left">
      ${
        params.qr
          ? `<button class="gqr" id="qrBtn" type="button" title="Show QR code" aria-label="Show QR code"><img src="${params.qr}" alt="QR code"/></button>`
          : `<div class="gqr ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`
      }
      <div class="gtitles">
        <h1 class="gtitle">Hasil Foto Mu</h1>
        <p class="gsub"><span id="tokenText"></span><span class="sep">&middot;</span><span id="timeText"></span></p>
      </div>
    </div>
  </header>
  <div id="note"></div>
  <div id="content"><div class="status pulse">Loading your memories&hellip;</div></div>
  <section class="contact" aria-label="Kontak Kelana">
    ${KELANA_LOGO_SVG}
    <h2>Suka hasil fotonya?</h2>
    <p>Bikin acaramu makin seru dengan photobooth Kelana: pernikahan, ulang tahun, wisuda, sampai gathering kantor. Yuk ngobrol dulu!</p>
    <div class="contact-actions">
      <a class="contact-btn contact-wa" href="${KELANA_WHATSAPP}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>
        Chat via WhatsApp
      </a>
      <a class="contact-btn contact-ig" href="${KELANA_INSTAGRAM}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        @kelanacirebon_
      </a>
    </div>
  </section>
  <footer>Kelana Photobooth &middot; Cirebon</footer>
</div>
<div class="viewer hidden" id="viewer" role="dialog" aria-modal="true" aria-label="Enlarged photo">
  <img id="viewerImg" src="" alt="Enlarged photo"/>
  <button class="viewer-close" id="viewerClose" type="button" aria-label="Close viewer">&#10005;</button>
  <div class="viewer-bar">
    <span class="name" id="viewerName"></span>
    <a class="btn" id="viewerDl" href="#" download>Download</a>
  </div>
</div>
<div class="qrmodal" id="qrmodal" role="dialog" aria-modal="true" aria-label="QR code">
  <div class="qrmodal-box" id="qrmodalBox">
    <h2>Scan untuk unduh</h2>
    <img id="qrFull" src="" alt="Large QR code"/>
    <p id="qrUrl"></p>
    <button class="btn" id="qrClose" type="button">Tutup</button>
  </div>
</div>
<script>
const TOKEN = ${tokenJson};
const CREATED_AT = ${createdAtJson};
const QR = ${qrJson};

const store = { files: [], photos: [] };

// Booth progress signals. print-request/print-result.json carry the timed
// flow's "customer arranged, booth is generating outputs" lifecycle; upload
// activity (file-key changes observed while this page is open) covers the
// non-timed flow which streams all outputs up in one shot.
const CONTROL = { printRequest: null, printResult: null };
let changeCount = 0;
let lastChangeAt = 0;

// The banner above the grid carries two independent messages: the booth's
// "still generating" state (driven by render()) and a download failure. The
// 5s poll re-renders whenever the file list changes, so a download error has
// to be parked here or it would be wiped mid-build.
let noteError = null;

function setNote(html, isError) {
  const box = document.getElementById('note');
  if (!box) return;
  if (html) {
    noteError = isError ? html : null;
    box.innerHTML = html;
  } else {
    noteError = null;
    box.innerHTML = '';
  }
}

const ERR_DOWNLOAD = '<div class="note err">Those files could not be downloaded. Please ask the booth attendant.</div>';

function fetchJson(name) {
  return fetch(location.origin + '/d/' + TOKEN + '/' + name + '?ts=' + Date.now())
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; });
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return day + '/' + month + '/' + year + ' ' + hour + ':' + minute;
}

function downloadUrl(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const EYE_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>';
const ICON_IMAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
const ICON_GIF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7.5 10h1.5v4H7.5z"/><path d="M11 10v4"/><path d="M11 12h2.5"/></svg>';

// Browsers only honor a handful of programmatic downloads per user gesture, so
// firing one anchor per output silently drops all but the last file. Instead the
// gallery fetches every selected output once and hands back a single .zip blob,
// which also gives the customer one clean file instead of a burst of downloads.
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

// A single output still downloads directly; two or more are zipped. zipName is
// the archive filename (the token keeps each session's file distinct).
async function downloadMany(items, btnId, zipName) {
  const btn = document.getElementById(btnId);
  if (!btn || items.length === 0) return;
  if (items.length === 1) {
    downloadUrl(items[0].url, items[0].name);
    return;
  }
  const original = btn.textContent;
  btn.disabled = true;
  try {
    const entries = [];
    for (let i = 0; i < items.length; i++) {
      btn.textContent = 'Packing ' + (i + 1) + ' / ' + items.length;
      let response;
      try {
        response = await fetch(items[i].url);
      } catch (error) {
        continue;
      }
      if (!response.ok) continue;
      entries.push({ name: items[i].name, bytes: new Uint8Array(await response.arrayBuffer()) });
    }
    if (entries.length === 0) {
      setNote(ERR_DOWNLOAD, true);
      return;
    }
    btn.textContent = 'Building ZIP&hellip;';
    const href = URL.createObjectURL(buildZip(entries));
    downloadUrl(href, zipName);
    // Give the browser time to start the download before dropping the blob.
    setTimeout(function () { URL.revokeObjectURL(href); }, 60000);
  } catch (error) {
    setNote(ERR_DOWNLOAD, true);
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}

function tileHtml(item, i) {
  return '<div class="tile" data-i="' + i + '" role="button" tabindex="0" aria-checked="false" aria-label="Select photo ' + (i + 1) + '">' +
    '<span class="badge">&#10003;</span>' +
    '<button class="eye" type="button" data-url="' + item.url + '" data-name="' + item.name + '" title="View larger" aria-label="View photo ' + (i + 1) + ' larger">' + EYE_SVG + '</button>' +
    '<img src="' + item.url + '" alt="Photo ' + (i + 1) + '" loading="lazy"/>' +
    '</div>';
}

// Framed output card (mirrors the admin results modal's ResultLink).
function resCard(icon, title, url, alt, label, square) {
  return '<div class="card">' +
    '<h4>' + icon + title + '</h4>' +
    '<button type="button" class="res' + (square ? ' sq' : '') + '" data-url="' + url + '" data-name="' + label + '" title="View larger">' +
      '<img src="' + url + '" alt="' + alt + '"/>' +
      '<span class="cap">' + icon + label + '</span>' +
    '</button>' +
  '</div>';
}

function syncActions() {
  const tiles = document.querySelectorAll('.tile.sel');
  const btnSel = document.getElementById('dlSelected');
  const btnAll = document.getElementById('selAll');
  const cnt = document.getElementById('selCount');
  if (btnSel) {
    btnSel.classList.toggle('hidden', tiles.length === 0);
    // More than one file is delivered as a single .zip rather than a burst of
    // separate downloads, so say so on the button itself.
    btnSel.textContent = 'Download selected (' + tiles.length + ')' + (tiles.length > 1 ? ' ZIP' : '');
  }
  if (btnAll) {
    const all = store.photos.length > 0 && tiles.length === store.photos.length;
    btnAll.textContent = all ? 'Clear all' : 'Select all';
  }
  if (cnt) cnt.textContent = tiles.length + ' / ' + store.photos.length + ' selected';
}

function toggleSel(i) {
  const tile = document.querySelectorAll('.tile')[i];
  if (!tile) return;
  tile.classList.toggle('sel');
  tile.setAttribute('aria-checked', tile.classList.contains('sel') ? 'true' : 'false');
  syncActions();
}

function selectAllToggle() {
  const tiles = document.querySelectorAll('.tile');
  const any = document.querySelectorAll('.tile:not(.sel)').length > 0;
  tiles.forEach(function (t) {
    t.classList.toggle('sel', any);
    t.setAttribute('aria-checked', any ? 'true' : 'false');
  });
  syncActions();
}

  function downloadAllPhotos() {
  downloadMany(store.photos, 'dlAllPhotos', 'photos-' + TOKEN + '.zip');
}

function downloadAllOutputs() {
  downloadMany(store.files, 'dlAllOutputs', 'photo-booth-' + TOKEN + '.zip');
}

function downloadSelected() {
  const items = [];
  document.querySelectorAll('.tile.sel').forEach(function (t) {
    const item = store.photos[Number(t.dataset.i)];
    if (item) items.push(item);
  });
  downloadMany(items, 'dlSelected', 'selected-' + TOKEN + '.zip');
}

function closeViewer() {
  document.getElementById('viewer').classList.add('hidden');
}

function openViewer(url, name) {
  const img = document.getElementById('viewerImg');
  img.src = url;
  // Raw captured photos stay square; framed/GIF results keep their rounding.
  img.classList.toggle('square', /photo-[0-9]+[.](jpe?g|png)$/i.test(name));
  document.getElementById('viewerName').textContent = name;
  const dl = document.getElementById('viewerDl');
  dl.href = url;
  dl.setAttribute('download', name);
  document.getElementById('viewer').classList.remove('hidden');
}

// The viewer + QR modal are static markup — wire their listeners once at
// startup so the polling re-renders below never stack duplicate listeners.
document.getElementById('viewer').addEventListener('click', function (e) {
  if (e.target.id === 'viewer') closeViewer();
});
document.getElementById('viewerClose').addEventListener('click', closeViewer);
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeViewer();
    document.getElementById('qrmodal').classList.remove('open');
  }
});
const qrBtn = document.getElementById('qrBtn');
if (qrBtn) {
  qrBtn.addEventListener('click', function () {
    if (!QR) return;
    document.getElementById('qrFull').src = QR;
    document.getElementById('qrUrl').textContent = location.href;
    document.getElementById('qrmodal').classList.add('open');
  });
}
document.getElementById('qrmodal').addEventListener('click', function (e) {
  if (e.target.id === 'qrmodal') document.getElementById('qrmodal').classList.remove('open');
});
document.getElementById('qrClose').addEventListener('click', function () {
  document.getElementById('qrmodal').classList.remove('open');
});

function wireViewer() {
  document.querySelectorAll('.res, .eye').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openViewer(btn.dataset.url, btn.dataset.name);
    });
  });
}

function wireActions() {
  document.getElementById('selAll').addEventListener('click', selectAllToggle);
  document.getElementById('dlAllPhotos').addEventListener('click', downloadAllPhotos);
  document.getElementById('dlAllOutputs').addEventListener('click', downloadAllOutputs);
  document.getElementById('dlSelected').addEventListener('click', downloadSelected);
  document.querySelectorAll('.tile').forEach(function (t, i) {
    t.addEventListener('click', function (e) {
      if (e.target.closest('.eye')) return;
      toggleSel(i);
    });
    t.addEventListener('keydown', function (e) {
      if (e.target.closest('.eye')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSel(i);
      }
    });
  });
  syncActions();
}

// Live-populating gallery: the timed flow sends the customer straight here
// after arranging, while the booth may still be uploading outputs — keep
// polling so new files (framed.png, GIFs, ...) appear without a refresh.
const POLL_MS = 5000;
let lastKey = '';

/**
 * Whether the session is still producing outputs. Timed flow is driven by
 * print-request/print-result.json (the booth generates framed.png + GIFs only
 * AFTER the customer arranges, so print-result 'ok' is the completion signal);
 * the non-timed flow streams everything up at once, so observed upload
 * activity within the last few seconds is the signal there.
 */
function pendingNote(files) {
  if (files.length === 0) return null;
  var names = files.map(function (f) { return f.name; });
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

function render(files) {
  const root = document.getElementById('content');
  const noteBox = document.getElementById('note');
  if (files.length === 0) {
    noteBox.innerHTML = '';
    root.innerHTML =
      '<div class="status pulse">Your photos are uploading &mdash; check back in a moment&hellip;</div>';
    return;
  }

  store.files = files.filter(function (f) {
    return !/^(meta|organize|print-request|print-result|live-clips)[.]json$/i.test(f.name);
  });

  const framed = store.files.filter(function (f) { return /framed[.]png$/i.test(f.name); });
  const liveGif = store.files.filter(function (f) { return /result-live[.]gif$/i.test(f.name); });
  const gif = store.files.filter(function (f) {
    return /[.]gif$/i.test(f.name) && !/result-live[.]gif$/i.test(f.name);
  });
  store.photos = store.files.filter(function (f) {
    return /[.](jpe?g|png)$/i.test(f.name) && !/framed[.]png$/i.test(f.name);
  });

  const note = pendingNote(files);
  if (noteError) {
    noteBox.innerHTML = noteError;
  } else if (note === 'busy') {
    noteBox.innerHTML =
      '<div class="note"><span class="spin"></span> Some outputs are still being generated &amp; uploaded &mdash; your photos are already here, more coming&hellip;</div>';
  } else if (note === 'error') {
    noteBox.innerHTML =
      '<div class="note err">Some outputs could not be generated. Please ask the booth attendant.</div>';
  } else {
    noteBox.innerHTML = '';
  }

  let side = '';
  if (framed.length) {
    side += resCard(ICON_IMAGE, 'Framed photo', framed[0].url, 'Framed photo', 'Framed', true);
  }
  if (liveGif.length) {
    side += resCard(ICON_GIF, 'Framed live photo', liveGif[0].url, 'Framed live version', 'Live', true);
  }
  if (gif.length) {
    side += resCard(ICON_GIF, 'Animated GIF', gif[0].url, 'Animated version', 'GIF', true);
  }

  let html = '<div class="grid3">';
  if (side) {
    html += '<div class="col-side">' + side + '</div>';
  }
  if (store.photos.length) {
    html += '<div class="col-main">' +
      '<div class="ph-head">' +
        '<h4>' + ICON_IMAGE + ' Photos (' + store.photos.length + ')</h4>' +
        '<span class="hint">Tap a photo to select, then download.</span>' +
      '</div>' +
      '<div class="pgrid">' + store.photos.map(tileHtml).join('') + '</div>' +
      '<div class="actions">' +
        '<button class="btn sm ghost" id="selAll" type="button">Select all</button>' +
        '<button class="btn sm hidden" id="dlSelected" type="button">Download selected</button>' +
        '<button class="btn sm" id="dlAllPhotos" type="button">Download all photos (ZIP)</button>' +
        '<button class="btn sm ghost" id="dlAllOutputs" type="button">Download all results (ZIP)</button>' +
        '<span class="count" id="selCount">0 / ' + store.photos.length + ' selected</span>' +
      '</div>' +
    '</div>';
  }
  html += '</div>';
  root.innerHTML = html;
  wireViewer();
  if (store.photos.length) wireActions();
}

function initHead() {
  document.getElementById('tokenText').textContent = TOKEN;
  document.getElementById('timeText').textContent = formatTime(CREATED_AT);
}

async function main() {
  const root = document.getElementById('content');
  let res;
  try {
    res = await fetch('/api/sessions/' + TOKEN);
  } catch (_e) {
    // Transient network blip — keep polling instead of giving up.
    setTimeout(main, POLL_MS);
    return;
  }
  let data;
  try {
    data = await res.json();
  } catch (_e) {
    setTimeout(main, POLL_MS);
    return;
  }
  if (!res.ok || !data.files || data.exists === false) {
    root.innerHTML = '<div class="err">We could not find this session. It may have expired.</div>';
    return;
  }

  // Refresh the booth's progress signals alongside the file list so the
  // "still generating" indicator tracks the timed flow's arrange→generate
  // lifecycle even when no file is being added right now.
  const [requestFile, resultFile] = await Promise.all([
    fetchJson('print-request.json'),
    fetchJson('print-result.json'),
  ]);
  CONTROL.printRequest = requestFile;
  CONTROL.printResult = resultFile;

  const key = data.files
    .map(function (f) { return f.name + ':' + f.size; })
    .sort()
    .join(',');
  if (key !== lastKey) {
    lastKey = key;
    changeCount += 1;
    lastChangeAt = Date.now();
    render(data.files);
  }
  setTimeout(main, POLL_MS);
}
initHead();
main();
</script>
</body>
</html>`;
};