/* 
 * jQuery googleStockChart
 *
 *
 * Copyright (c) 2012 Bozell (bozell.com)
 * Dual licensed under the MIT or GPL Version 3 licenses.
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 * Author: Jacob Dunn
 * Dependencies: jQuery, jQuery-color, jQuery Cookie, jQuery UI (UI Core, UI Widget, UI Mouse)
 *
 * http://jquery.com/
 * https://github.com/jquery/jquery-color
 * http://plugins.jquery.com/project/cookie
 *
 */

(function ($) {

    var defaults = {
        "data": "http://www.google.com/finance/info?client=ig&q=",
        "chart": "http://www.google.com/finance/chart?cht=c&q=",
        "chartDetailed": "http://www.google.com/finance/chart?tlf=12&chs=m&q=",
        "match": "http://www.google.com/finance/match?matchtype=matchall&q=",
		"yql": "select * from html where url='{url}' limit 1",
        "indexes": ["INDEXDJX:.DJI", "INDEXSP:.INX", "INDEXNASDAQ:.IXIC"],
        "indexesDetail": [],
        "cookies": true,
        "cookiesExpires": 365, //one year
        "chartSize": "small", //small, medium, or large
        "inputLabel": "GOOG,.DJI,CSCO",
        "sortable": true,
        "indicateErrors": true
    }

    var methods = {
        init: function (options) {
            return this.each(function () {
                var data = {
                    'settings': $.extend(defaults, options)
                }

                //See if there is a cookie set
                if(data.settings.cookies && typeof $.cookie == 'function'){
                    var indexes = $.cookie('googleStockChart_indexes');
                    if(indexes) data.settings.indexes = indexes.split(',');
                }

                var $this = $(this).addClass('google-stock-chart').addClass(data.settings.chartSize);

                this.$chart = $('<div class="chart ' + data.settings.chartSize + '"/>').appendTo($this);
                this.$list = $('<ul/>').appendTo($this);
                var $form = this.$form = $('<form class="add-indexes"/>').appendTo($this);
				var $refresh = this.$refresh = $('<a class="refresh" href="#refresh" title="Refresh">Refresh</a>').appendTo($this);
				
				var $input = this.$input = $('<input type="text"/>').appendTo($form);
				data.inputBg = $input.css("background-color");
				
				//Input Labelling
				$input.focus(function(){
					if($(this).val() == data.settings.inputLabel) $(this).val('').removeClass('labeled');
				}).blur(function(){
					if($(this).val() == '') $(this).val(data.settings.inputLabel).addClass('labeled');
				}).blur();


                //Form Submissions
                $form.submit(function () {
                    var value = $input.val().replace(' ', '');
                    var values = value.split(',');
                    $(values).each(function () {
                        methods.addIndex.apply($this[0], [this]);
                    });
                    return false;
                });

                //Manual Refresh
                $refresh.click(function () {
                    methods.update.apply($this[0]);
                    return false;
                });

                //Sortables
                if(data.settings.sortable)
                    methods.makeSortable.apply(this);

                //Event Handlers
                $this.bind('lookup-success', function () {
                    $input.val('').focus();
                });
                $this.bind('lookup-fail', function () {
                    $input.stop()
                          .animate({ backgroundColor: '#eb6545' }, 25)
                          .animate({ backgroundColor: data.inputBg }, 800);
                });

                //Ajax Event Handlers
                $this.ajaxStart(function(){
                    data = $this.data();
                    data.ajaxRunning = true;
                    $this.append('<div class="ajax-running"/>');
                    $this.data(data);
                });

                $this.ajaxComplete(function(){
                    data = $this.data();
                    data.ajaxRunning = false;
                    $('.ajax-running',$this).remove();
                    $this.data(data);
                    
                    if(data.updateQueued)
                        methods.update.apply(this);
                });

                $this.data(data);

                methods.update.apply(this);
            });
        },
        makeSortable: function()
        {
            var $this = $(this);
            var data = $this.data();

            //Check dependancies
            if(typeof this.$list.sortable != 'function') return false;

            this.$list.sortable({
                revert:250,
                placeholder: "sort-placeholder",
                forcePlaceholderSize:true
            }).bind('sortupdate', function(event,ui){
                methods.checkOrder.apply($this[0]);
            }).disableSelection();

        },
        checkOrder: function(){
            var $this = $(this);
            var data = $this.data();
            var newList = new Array();

            $('li',this.$list).each(function(index){
                var liData = $(this).data();
                newList.push(liData.e + ":" + liData.t);
                $(this).attr('class','index-'+index);
            });

            data.settings.indexes = newList;

            $this.data(data);
            methods.setCookie.apply(this);
            methods.update.apply(this);
        },
        setCookie: function()
        {
            var data = $(this).data();
            
            if(!data.settings.cookies || typeof $.cookie != 'function') return;

            $.cookie('googleStockChart_indexes',
                data.settings.indexes.join(","),
                {"expires":data.settings.cookiesExpires});
        },
        removeIndex: function (index) {
            var data = $(this).data();

            data.settings.indexes = $.grep(data.settings.indexes, function (value) {
                return value !== index;
            });

            $(this).data(data);
            
            methods.setCookie.apply(this);
            methods.update.apply(this);
        },
        addIndex: function (index) {
			
            var $this = $(this);
            var data = $this.data();

            //Make sure it's valid
			var detailURL = data.settings.match + index;
			$.YQL(data.settings.yql.replace("{url}",detailURL), function(data) {
				if(data.query.results == null) return;
				returned = eval('('+data.query.results.body.p+')');
				
                if (returned.matches.length > 0 && returned.matches[0].e && returned.matches[0].t) {
                    var stock = returned.matches[0].e + ":" + returned.matches[0].t;
                    data = $this.data();

                    //Make sure it's not a duplicate
                    if ($.grep(data.settings.indexes, function (value) {
                        return value === stock;
                    }).length > 0) {
                        $this.trigger('lookup-fail');
                        return;
                    }

                    data.settings.indexes.push(stock);
                    data.settings.indexesDetail[stock] = returned;

                    $this.data(data);
                    $this.trigger('lookup-success');
                    
                    methods.setCookie.apply($this[0]);
                    methods.update.apply($this[0]);
                } else {
                    $this.trigger('lookup-fail');
                }
            });
        },
        getTitle: function (title) {
            //Format
            title = title.replace('.', '').toLowerCase();

            //Scrubs most common title abbreviations
            switch (title) {
                case "dji": return "dow";
                case "inx": return "s&p";
                case "ixic": return "nasdaq";
                default: return title;
            }
        },
        update: function () {
            var data = $(this).data(),
                $this = $(this),
                $list = this.$list,
                $chart = this.$chart;

            if(data.ajaxRunning){ //Do not update if AJAX request is in progress
                data.updateQueued = true;
                $this.data(data);
                return;
            }

            var dataURL = data.settings.data + data.settings.indexes.join(",") + "&callback=?";
            var chartURL = data.settings.chart + data.settings.indexes.join(",") + "&chs=" + data.settings.chartSize.substring(0, 1);

            //Load the new Listings
            $.getJSON(dataURL, function (data) {
                $list.empty();
                $(data).each(function (index) {
                    var $li = $('<li/>').appendTo($list);
                    var title = methods.getTitle.apply(this, [this.t]);
                    var stock = this.e + ":" + this.t;

                    $li.addClass('index-' + index);
                    $li.append('<span class="color"/>');
                    $li.append('<strong><a href="http://www.google.com/finance?q=' + this.t + '">' + title + '</a></strong>');
                    $li.append('<small class="amount">' + this.l + '</small>');
                    $li.append('<span class="values">' + this.c + ' <small>(' + this.cp + '%)</small></span>');
                    $li.append('<a href="#delete" class="delete" title="Remove ' + title.toUpperCase() + '">-</a>');

                    $('.values', $li).addClass((Number(this.c) >= 0) ? 'plus' : 'minus');
                    $('.delete', $li).click(function () {
                        var title = methods.removeIndex.apply($this[0], [stock]);
                        return false;
                    });

                    $li.mouseenter(function () {
                        methods.displayDetails.apply(this);
                    }).mouseleave(function () {
                        methods.hideDetails.apply(this);
                    });

                    $li.data(this);
                });
            
                $this.trigger('chart-updated');
            });

            //Load the new Chart
            $('img', $chart).stop().fadeTo(500, 0, function () {
                $(this).remove();
            });

            $img = $('<img/>').appendTo($chart);
            $img.load(function () {
                $(this).fadeTo(500, 1);
            });
            $img.css({ opacity: 0 }).attr('src', chartURL);
            
            data.updateQueued = false;
            $this.data(data);
        },
        displayDetails: function () {
            var $li = $(this),
                $this = $li.parents('.google-stock-chart:first'),
                $popup = $('.popup', $li),
                liData = $li.data(),
                data = $this.data();

            if (!data) return;

            var index = liData.e + ":" + liData.t;

            //Create the popup, if it's not already there
            if ($popup.length == 0) {
                $popup = $('<div class="popup"/>').appendTo($li);
                $popup.append('<div class="detail-chart"><img/></div>');
                $popup.append('<h2/><p class="index">' + index + '</p>');
                $popup.append('<p class="last-trade"/>');
                $popup.append('<p class="trade-time"/>');
                $popup.append('<p class="change"/>');
                $popup.css({opacity:0});

                var chartURL = data.settings.chartDetailed + index;
                var $img = $popup.find('img');
                $img.load(function () {
                    $(this).fadeTo(500, 1);
                }).css({ opacity: 0 }).attr('src', chartURL);
            }

            //If we need detail, get it, then update the popup
            var indexDetail = data.settings.indexesDetail[index];
            if (!indexDetail) {
                var detailURL = data.settings.match + index;
				$.YQL(data.settings.yql.replace("{url}",detailURL), function(data) {
					if(data.query.results == null) return;
					returned = eval('('+data.query.results.body.p+')');
					
                    if (returned.matches.length > 0 && returned.matches[0].e && returned.matches[0].t) {
                        var stock = returned.matches[0].e + ":" + returned.matches[0].t;
                        data.settings.indexesDetail[stock] = returned;
                        
                        $this.data(data);

                        if($li[0].visible)
                            methods.displayDetails.apply($li[0]);
                    }
                });
            }

            //Load in the relevant data
            $('.last-trade', $popup).html('<strong>Last Trade</strong>'+liData.l);
            $('.trade-time', $popup).html('<strong>Trade Time</strong>' + liData.ltt);
            $('.change', $popup)
                .html('<strong>Change</strong>' + liData.c + " <small>(" + liData.cp + ")</small>")
                .attr('class','change '+ ((Number(liData.c) >= 0) ? 'plus' : 'minus'));

            if (indexDetail) {
                $('h2', $popup).text(indexDetail.matches[0].n);
            }

            this.visible = true;
            $popup.stop().show().fadeTo(200,1);
        },
        hideDetails: function(){
            var $li = $(this),
                $popup = $('.popup', $li);

                
            this.visible = false;
            $popup.stop().fadeTo(200,0,function(){
                $(this).hide();
            });
        }
    };

    $.fn.googleStockChart = function (method) {

        // Method calling logic
        if (methods[method]) {
            var params = Array.prototype.slice.call(arguments, 1);
            return this.each(function () {
                methods[method].apply(this, params);
            });
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.googleStockChart');
        }

    };

})(jQuery);

$.YQL = function(query, callback) {
 
    if (!query || !callback) {
        throw new Error('$.YQL(): Parameters may be undefined');
    }
 
    var encodedQuery = encodeURIComponent(query.toLowerCase()),
        url = 'http://query.yahooapis.com/v1/public/yql?q='
            + encodedQuery + '&format=json&callback=?';

    $.getJSON(url, callback); 
};