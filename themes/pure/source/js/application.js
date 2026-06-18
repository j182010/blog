$(function() {
  // bootstrap tooltip
  $('[data-toggle="tooltip"]').tooltip();

  // slimscroll
  if (typeof $.fn.slimScroll != 'undefined') {
    $(".sidebar .slimContent").slimScroll({
      height: $(window).height(),
      color: "rgba(0,0,0,0.15)",
      size: "5px",
      position: 'right',
      // allowPageScroll: true
    });
  }

  $('#collapseToc').on('shown.bs.collapse', function() {
    // do something…
    // slimscroll
    if (typeof $.fn.slimScroll != 'undefined') {
      $(".sidebar .slimContent").slimScroll().on('slimscroll');
    }
  });

  // geopattern 背景生成
  $(".geopattern").each(function() {
    $(this).geopattern($(this).data('pattern-id'));
  });

  // okayNav
  var navigation = $('#nav-main').okayNav({
    swipe_enabled: false, // If true, you'll be able to swipe left/right to open the navigation
  });

  // modal居中
  // $('.modal').on('shown.bs.modal', function(e) {
  //   $(this).show();
  //   var modalDialog = $(this).find(".modal-dialog");
  //    // Applying the top margin on modal dialog to align it vertically center 
  //   modalDialog.css("margin-top", Math.max(0, ($(window).height() - modalDialog.height()) / 2));
  // });

  // sticky
  $('[data-stick-bottom]').keepInView({
    fixed: false,
    parentClass: "has-sticky",
    customClass: "sticky",
    trigger: 'bottom',
    zindex: 42,
    edgeOffset: 0
  });
  
  $('[data-stick-top]').keepInView({
    fixed: true,
    parentClass: "has-sticky",
    customClass: "sticky",
    trigger: 'top',
    zindex: 42,
    edgeOffset: 0
  });

  // menu auto highlight
  var menuHighlight = $("ul.main-nav").hasClass('menu-highlight');
  if (menuHighlight) {
    var currentPathname = location.pathname,
      $menuList = $("ul.main-nav>li"),
      activeIndex = -1;
    for (var i = 0, length = $menuList.length; i < length; i++) {
      var itemHref = $($menuList[i]).find('a').attr('href');
      if (currentPathname.indexOf(itemHref) > -1 ||
        (currentPathname === '/' && (itemHref === '/.' || itemHref === '/' || itemHref === 'index.html' || itemHref === '/index.html'))) {
        activeIndex = i;
      }
      $($menuList[i]).removeClass('active');
    }
    $menuList[activeIndex] && $($menuList[activeIndex]).addClass('active');
  }

    // 代码块复制按钮 & 展开按钮
  $('.highlight').each(function() {
    var $block = $(this);
    var $expandBtn = $('<button class="expand-btn" type="button">展开</button>');
    var $copyBtn = $('<button class="copy-btn" type="button">复制</button>');
    $block.append($expandBtn).append($copyBtn);

    // 展开 / 收起切换
    $expandBtn.on('click', function() {
      if ($block.hasClass('expanded')) {
        $block.removeClass('expanded');
        $expandBtn.text('展开');
      } else {
        $block.addClass('expanded');
        $expandBtn.text('收起');
      }
    });

    $copyBtn.on('click', function() {
      var $pre = $block.find('pre').not('.gutter pre');
      // 如果没有 td.code 外的 pre，尝试从 table 的 code 列取
      if ($pre.length === 0) {
        $pre = $block.find('td.code pre');
      }
      if ($pre.length === 0) {
        $pre = $block.find('pre');
      }
      var text = '';
      // 逐行读取，避免缺失换行
      $pre.each(function() {
        var lines = $(this).find('.line');
        if (lines.length > 0) {
          var linesText = [];
          lines.each(function() {
            linesText.push($(this).text());
          });
          text += linesText.join('\n') + '\n';
        } else {
          text += $(this).text() + '\n';
        }
      });
      text = text.replace(/\n+$/, '');

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          showCopied($copyBtn);
        }, function() {
          fallbackCopy(text, $copyBtn);
        });
      } else {
        fallbackCopy(text, $copyBtn);
      }
    });
  });

  function showCopied($btn) {
    var original = $btn.text();
    $btn.addClass('copied').text('已复制');
    setTimeout(function() {
      $btn.removeClass('copied').text(original);
    }, 1500);
  }

  function fallbackCopy(text, $btn) {
    var $ta = $('<textarea></textarea>');
    $ta.val(text).css({
      position: 'fixed',
      top: 0,
      left: 0,
      width: '1px',
      height: '1px',
      padding: 0,
      border: 'none',
      outline: 'none',
      boxShadow: 'none',
      background: 'transparent',
      opacity: 0
    });
    $('body').append($ta);
    $ta[0].select();
    try {
      document.execCommand('copy');
      showCopied($btn);
    } catch (e) {
      $btn.text('复制失败');
      setTimeout(function() { $btn.text('复制'); }, 1500);
    }
    $ta.remove();
  }
});