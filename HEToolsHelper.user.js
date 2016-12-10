// ==UserScript==
// @name         HETools Helper
// @namespace    HEToolsHelper
// @version      1.3.0
// @description  A small script that enables you to sync your Hacker Experience HDB with HETools
// @author       Jasper van Merle
// @match        https://legacy.hackerexperience.com/*
// @match        https://en.hackerexperience.com/*
// @match        https://br.hackerexperience.com/*
// @grant        none
// ==/UserScript==

const ISP_IP = '195.153.108.51';

var HEToolsHelper = {};

HEToolsHelper.Utils = {};

HEToolsHelper.Utils.isGritterLoaded = false;
HEToolsHelper.Utils.notify = function(title, message) {
    if (!HEToolsHelper.Utils.isGritterLoaded) {
        $('<link rel="stylesheet" type="text/css" href="css/jquery.gritter.css">').appendTo('head');
        $.getScript('js/jquery.gritter.min.js', function() {
            $.gritter.add({
                title: title,
                text: message,
                image: '',
                sticky: false
            });
        });
        HEToolsHelper.Utils.isGritterLoaded = true;
        return;
    }
    $.gritter.add({
        title: title,
        text: message,
        image: '',
        sticky: false
    });
};

HEToolsHelper.Utils.isLoggedIn = function() {
    return $('a[href="logout"]').length > 0;
};

HEToolsHelper.Utils.isOnPage = function(page) {
    return window.location.pathname === page;
};

HEToolsHelper.Helper = {};

HEToolsHelper.Helper.HEToolsBaseURL = 'https://jaspervanmerle.com/hetools';

HEToolsHelper.Helper.updateAPIKey = function(key) {
    localStorage.setItem('he-tools-apikey', key);
    HEToolsHelper.Utils.notify('HETools Helper', 'Updated API key!');
    if (localStorage.getItem('he-tools-apikey') != null) {
        $('#apikey').val(localStorage.getItem('he-tools-apikey')).change();
    }
};

HEToolsHelper.Helper.updateIPCheckingPermission = function(value) {
    if (value == 'yes') {
        localStorage.setItem('he-tools-ip-checking-permission', 'yes');
        $('#ipCheckingPermission').val('yes');
    } else {
        localStorage.setItem('he-tools-ip-checking-permission', 'no');
        $('#ipCheckingPermission').val('no');
    }
    HEToolsHelper.Utils.notify('HETools Helper', 'Updated IP checking permission!');
};

HEToolsHelper.Helper.checkAndUpdateIPs = function() {
    var IPs = [];
    var apiKey = localStorage.getItem('he-tools-apikey');

    var checkIPsIfNotLoggedIn = function(ipArr) {
        if (ipArr.length == 0) {
            return;
        }

        $.get(window.location.origin + '/internet?ip=1.2.3.4', function(data) {
            if ($('div.alert:contains("You are currently logged to")', data).length === 0) {
                checkIPs(ipArr);
            }
        });
    };

    var checkIPs = function(ipArr) {
        if (ipArr.length == 0) {
            $.get(window.location.origin + '/internet?ip=1.2.3.4');
            return;
        }

        var ip = IPs.pop();

        $.get(window.location.origin + '/internet?ip=' + ip, function(data) {
            var type;
            if ($('div:contains("404 - Page not found")', data).length) {
                type = 'Deleted';
            } else {
                type = $('div.widget-content.padding.noborder > div.span12:nth-child(1) > p > span', data).text();
            }

            var ipString = type + ':' + ip;

            $.post(HEToolsHelper.Helper.HEToolsBaseURL + '/api/update-ip-types.php', {'api-key': apiKey, 'ip': ipString}, function(data) {
                checkIPs(IPs);
            });
        });
    };

    $.post(HEToolsHelper.Helper.HEToolsBaseURL + '/api/get-ips-to-check.php', {'api-key': apiKey}).done(function(data) {
        var output = JSON.parse(data);
        if (output['success']) {
            IPs = output.payload.ips;
            if (IPs.length !== 0) {
                checkIPs(IPs);
            }
        } else {
            if (output["errorCode"] == 201) {
                HEToolsHelper.Utils.notify('HETools Helper', 'The API key you gave is not valid. Please update it in the HETools Helper Settings on the Hacked Database page to sync your HDB again.');
            }
        }
    });
};

HEToolsHelper.Helper.syncHDB = function() {
    var ipList = [];
    var pagesToGo = [];

    if ($('div.pagination.alternate').length) {
        var numberOfPages = $('div.pagination.alternate > ul > li:nth-last-child(2)').text();
    } else {
        var numberOfPages = 1;
    }

    for (var i = 1; i <= numberOfPages; i++) {
        pagesToGo.push(i);
    }

    function loadPages(pageArr) {
        if (pageArr.length == 0) {
            continueSync();
            return;
        }

        var pageNumber = pageArr.pop();

        $.get(window.location.origin + '/list?page=' + pageNumber).done(function(data) {
            $('ul#list > li', data).each(function(index) {
                var type = $('div.list-ip > a > span:nth-child(1)', this).text();
                var ip = $('div.list-ip > a > span:nth-child(2)', this).text();
                var username = $('div.list-user > span:nth-child(2)', this).text();
                var password = $('div.list-user > span:nth-child(4)', this).text();

                if (type != 'VPC') {
                    if (username == 'clan') {
                        type = 'Clan Server';
                    } else {
                        type = 'Unknown';
                    }
                }

                ipList.push(type + ':' + ip);
            });
        }).always(function() {
            loadPages(pagesToGo);
        });
    }

    $("#syncTabLink").off("click");
    loadPages(pagesToGo);

    function continueSync() {
        var apiKey = localStorage.getItem('he-tools-apikey');

        $.post(HEToolsHelper.Helper.HEToolsBaseURL + '/api/get-add-ips-requests-left.php', {'api-key': apiKey}).done(function(data) {
            var output = JSON.parse(data);
            if (output['success']) {
                var requestsLeft = output.payload.requestsLeft;
                var amount = ipList.length;

                if (requestsLeft - amount >= 0) {
                    var finalList = [];
                    while (ipList.length > 0) {
                        finalList.push(ipList.splice(0, 1000));
                    }
                    $.each(finalList, function(index, element) {
                        var ipArr = JSON.stringify(element);
                        $.post(HEToolsHelper.Helper.HEToolsBaseURL + '/api/add-ips.php', {'api-key': apiKey, 'ips': ipArr});
                    });
                    HEToolsHelper.Utils.notify('HETools Helper', 'Your HDB has been synced with HETools!');
                } else {
                    HEToolsHelper.Utils.notify('HETools Helper', 'You attempted to sync your HDB too much. Please try again in an hour.');
                }
                $("#syncTabLink").remove();
            } else {
                if (output["errorCode"] == 201) {
                    HEToolsHelper.Utils.notify('HETools Helper', 'The API key you gave is not valid. Please update it in the HETools Helper Settings on the Hacked Database page to sync your HDB again.');
                }
                $("#syncTabLink").click(function() {
                    HEToolsHelper.Helper.syncHDB();
                });
            }
        });
    }
};

HEToolsHelper.Helper.openSettings = function() {
    $('#hetools-helper-settings-modal').modal('toggle');
    $('.modal-backdrop').removeClass('modal-backdrop');
};

HEToolsHelper.Helper.injectTab = function() {
    var settingsTab = $('<li class="link"><a id="settingsTabLink"><span class="icon-tab he16-clan_adm"></span><span class="hide-phone">HETools Helper Settings</span></a></li>');
    $('ul.nav.nav-tabs:contains("IP")').append(settingsTab);
    $('#settingsTabLink').click(function() {
        HEToolsHelper.Helper.openSettings();
    });
    var syncTab = $('<li class="link"><a id="syncTabLink"><span class="icon-tab he16-world"></span><span class="hide-phone">Sync HDB with HETools</span></a></li>');
    if (localStorage.getItem('he-tools-apikey') != null) {
        $('ul.nav.nav-tabs:contains("IP")').append(syncTab);
        $('#syncTabLink').click(function() {
            HEToolsHelper.Helper.syncHDB();
        });
    }
    var modal = $('<div id="hetools-helper-settings-modal" class="modal fade" tabindex="-1" role="dialog"> <div class="modal-dialog"> <div class="modal-content"> <div class="modal-header"> <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button> <h4 class="modal-title">HETools Helper Settings (v' + GM_info.script.version + ')</h4> </div><div class="modal-body"> <p>To sync you Hacked Database with <a href="https://jaspervanmerle.com/hetools/" target="_blank">HETools</a>, you will need to fill in the API Key from HETools which you can find <a href="https://jaspervanmerle.com/hetools/api-settings" target="_blank">here</a>. <div class="controls"> <input type="text" id="apikey" style="box-sizing: border-box; width: 100%; height: 34px; margin-bottom: 0px;" placeholder="Put your HE Tools API Key here"> </div><button class="btn btn-primary btn-block" id="updateAPIKeyButton">Update HE Tools API Key</button><br /><p>HETools can automatically check the types of your IP\'s, delete resetted ones and add aliases to Clan Servers (their names). This happens while you are playing and consumes bandwidth. This is an opt-in feature. <div class="controls"> <select id="ipCheckingPermission" style="box-sizing: border-box; width: 100%; height: 34px; margin-bottom: 0px;"><option value="no">No, I do not give permission to do this.</option><option value="yes">Yes, I do give permission.</option></select> </div><button class="btn btn-primary btn-block" id="updateIPCheckingPermissionButton">Update my IP checking permissions</button></div><div class="modal-footer"> <button type="button" class="btn btn-default" data-dismiss="modal">Close</button> </div></div></div></div>');
    modal.appendTo(document.body);
    $('#updateAPIKeyButton').on('click', function() {
        HEToolsHelper.Helper.updateAPIKey($('#apikey').val());
    });
    $('#updateIPCheckingPermissionButton').on('click', function() {
        HEToolsHelper.Helper.updateIPCheckingPermission($('#ipCheckingPermission').val());
    });
    if (localStorage.getItem('he-tools-apikey') != null) {
        $("#apikey").val(localStorage.getItem('he-tools-apikey')).change();
    }
    if (localStorage.getItem('he-tools-ip-checking-permission') == null || localStorage.getItem('he-tools-ip-checking-permission') == 'no') {
        $('#ipCheckingPermission').val('no');
    } else {
        $('#ipCheckingPermission').val('yes');
    }
};

$(document).ready(function() {
    if (HEToolsHelper.Utils.isLoggedIn()) {
        if ((window.location.pathname == '/list.php' || window.location.pathname == '/list' || window.location.pathname == '/list#') && window.location.search == '') {
            HEToolsHelper.Helper.injectTab();
        } else {
            if (localStorage.getItem('he-tools-ip-checking-permission') == 'yes' && !HEToolsHelper.Utils.isOnPage('/internet')) {
                HEToolsHelper.Helper.checkAndUpdateIPs();
            }
        }
    }
});
