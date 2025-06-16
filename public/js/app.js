(function ($) {
    "use strict";

    var e, t, n, s = localStorage.getItem("language"), i = "en";

    function r(t) {
        if (document.getElementById("header-lang-img")) {
            if (t == "en") {
                document.getElementById("header-lang-img").src = "assets/images/flags/us.jpg";
            } else if (t == "sp") {
                document.getElementById("header-lang-img").src = "assets/images/flags/spain.jpg";
            } else if (t == "gr") {
                document.getElementById("header-lang-img").src = "assets/images/flags/germany.jpg";
            } else if (t == "it") {
                document.getElementById("header-lang-img").src = "assets/images/flags/italy.jpg";
            } else if (t == "ru") {
                document.getElementById("header-lang-img").src = "assets/images/flags/russia.jpg";
            }
            localStorage.setItem("language", t);
        }

        if (s == "null") {
            r(i);
        }

        $.getJSON("assets/lang/" + s + ".json", function (t) {
            $("html").attr("lang", s);
            $.each(t, function (t, e) {
                if (t === "head") {
                    $(document).attr("title", e.title);
                }
                $("[key='" + t + "']").text(e);
            });
        });
    }

    function o() {
        var t = document.querySelectorAll(".counter-value");
        t.forEach(function (s) {
            (function t() {
                var e = +s.getAttribute("data-target"),
                    a = +s.innerText,
                    n = e / 250;
                if (n < 1) {
                    n = 1;
                }
                if (a < e) {
                    s.innerText = (a + n).toFixed(0);
                    setTimeout(t, 1);
                } else {
                    s.innerText = e;
                }
            })();
        });
    }

    function l() {
        var t = document.getElementById("topnav-menu-content").getElementsByTagName("a");
        for (var e = 0, a = t.length; e < a; e++) {
            if (t[e].parentElement.getAttribute("class") === "nav-item dropdown active") {
                t[e].parentElement.classList.remove("active");
                t[e].nextElementSibling.classList.remove("show");
            }
        }
    }

    function d(t) {
        if (document.getElementById(t)) {
            document.getElementById(t).checked = true;
        }
    }

    function c() {
        if (!document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
            console.log("pressed");
            $("body").removeClass("fullscreen-enable");
        }
    }

    $("#side-menu").metisMenu();
    o();

    e = document.body.getAttribute("data-sidebar-size");

    $(window).on("load", function () {
        $(".switch").on("switch-change", function () {
            toggleWeather();
        });

        if (window.innerWidth >= 1024 && window.innerWidth <= 1366) {
            document.body.setAttribute("data-sidebar-size", "sm");
            d("sidebar-size-small");
        }
    });

    $("#vertical-menu-btn").on("click", function (t) {
        t.preventDefault();
        $("body").toggleClass("sidebar-enable");
        if ($(window).width() >= 992) {
            if (e === null) {
                if (document.body.getAttribute("data-sidebar-size") === null || document.body.getAttribute("data-sidebar-size") === "lg") {
                    document.body.setAttribute("data-sidebar-size", "sm");
                } else {
                    document.body.setAttribute("data-sidebar-size", "lg");
                }
            } else if (e === "md") {
                if (document.body.getAttribute("data-sidebar-size") === "md") {
                    document.body.setAttribute("data-sidebar-size", "sm");
                } else {
                    document.body.setAttribute("data-sidebar-size", "md");
                }
            } else if (document.body.getAttribute("data-sidebar-size") === "sm") {
                document.body.setAttribute("data-sidebar-size", "lg");
            } else {
                document.body.setAttribute("data-sidebar-size", "sm");
            }
        }
    });

    $("#sidebar-menu a").each(function () {
        var t = window.location.href.split(/[?#]/)[0];
        if (this.href === t) {
            $(this).addClass("active");
            $(this).parent().addClass("mm-active");
            $(this).parent().parent().addClass("mm-show");
            $(this).parent().parent().prev().addClass("mm-active");
            $(this).parent().parent().parent().addClass("mm-active");
            $(this).parent().parent().parent().parent().addClass("mm-show");
            $(this).parent().parent().parent().parent().parent().addClass("mm-active");
        }
    });

    $(document).ready(function () {
        var t;
        if ($("#sidebar-menu").length && $("#sidebar-menu .mm-active .active").length && (t = $("#sidebar-menu .mm-active .active").offset().top) > 300) {
            t -= 300;
            $(".vertical-menu .simplebar-content-wrapper").animate({ scrollTop: t }, "slow");
        }
    });

    $(".navbar-nav a").each(function () {
        var t = window.location.href.split(/[?#]/)[0];
        if (this.href === t) {
            $(this).addClass("active");
            $(this).parent().addClass("active");
            $(this).parent().parent().addClass("active");
            $(this).parent().parent().parent().addClass("active");
            $(this).parent().parent().parent().parent().addClass("active");
            $(this).parent().parent().parent().parent().parent().addClass("active");
            $(this).parent().parent().parent().parent().parent().parent().addClass("active");
        }
    });

    $('[data-toggle="fullscreen"]').on("click", function (t) {
        t.preventDefault();
        $("body").toggleClass("fullscreen-enable");
        if (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement) {
            if (document.cancelFullScreen) {
                document.cancelFullScreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitCancelFullScreen) {
                document.webkitCancelFullScreen();
            }
        } else {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            } else if (document.documentElement.mozRequestFullScreen) {
                document.documentElement.mozRequestFullScreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            }
        }
    });

    document.addEventListener("fullscreenchange", c);
    document.addEventListener("webkitfullscreenchange", c);
    document.addEventListener("mozfullscreenchange", c);

    if (document.getElementById("topnav-menu-content")) {
        var u = document.getElementById("topnav-menu-content").getElementsByTagName("a");
        for (var m = 0, b = u.length; m < b; m++) {
            u[m].onclick = function (t) {
                if (t.target.getAttribute("href") === "#") {
                    t.target.parentElement.classList.toggle("active");
                    t.target.nextElementSibling.classList.toggle("show");
                }
            };
        }
        window.addEventListener("resize", l);
    }

    [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]')).map(function (t) {
        return new bootstrap.Tooltip(t);
    });

    [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]')).map(function (t) {
        return new bootstrap.Popover(t);
    });

    [].slice.call(document.querySelectorAll(".toast")).map(function (t) {
        return new bootstrap.Toast(t);
    });

    if (window.sessionStorage) {
        if ((t = sessionStorage.getItem("is_visited"))) {
            $("#" + t).prop("checked", true);
        } else {
            sessionStorage.setItem("is_visited", "layout-ltr");
        }
    }

    $("#password-addon").on("click", function () {
        if ($(this).siblings("input").length > 0) {
            if ($(this).siblings("input").attr("type") == "password") {
                $(this).siblings("input").attr("type", "input");
            } else {
                $(this).siblings("input").attr("type", "password");
            }
        }
    });

    if (s != "null" && s !== i) {
        r(s);
    }

    $(".language").on("click", function (t) {
        r($(this).attr("data-lang"));
    });

    $(window).on("load", function () {
        $("#status").fadeOut();
        $("#preloader").delay(350).fadeOut("slow");
    });

    $(".right-bar-toggle").on("click", function (t) {
        $("body").toggleClass("right-bar-enabled");
    });

    $(document).on("click", "body", function (t) {
        if ($(t.target).closest(".right-bar-toggle, .right-bar").length === 0) {
            $("body").removeClass("right-bar-enabled");
        }
    });

    n = document.getElementsByTagName("body")[0];

    if (n.hasAttribute("data-layout") && n.getAttribute("data-layout") === "horizontal") {
        d("layout-horizontal");
        $(".sidebar-setting").hide();
    } else {
        d("layout-vertical");
    }

    if (n.hasAttribute("data-bs-theme") && n.getAttribute("data-bs-theme") === "dark") {
        d("layout-mode-dark");
    } else {
        d("layout-mode-light");
    }

    if (n.hasAttribute("data-layout-size") && n.getAttribute("data-layout-size") === "boxed") {
        d("layout-width-boxed");
    } else {
        d("layout-width-fluid");
    }

    if (n.hasAttribute("data-layout-scrollable") && n.getAttribute("data-layout-scrollable") === "true") {
        d("layout-position-scrollable");
    } else {
        d("layout-position-fixed");
    }

    if (n.hasAttribute("data-topbar") && n.getAttribute("data-topbar") === "dark") {
        d("topbar-color-dark");
    } else {
        d("topbar-color-light");
    }

    if (n.hasAttribute("data-sidebar-size") && n.getAttribute("data-sidebar-size") === "sm") {
        d("sidebar-size-small");
    } else if (n.hasAttribute("data-sidebar-size") && n.getAttribute("data-sidebar-size") === "md") {
        d("sidebar-size-compact");
    } else {
        d("sidebar-size-default");
    }

    if (n.hasAttribute("data-sidebar") && n.getAttribute("data-sidebar") === "brand") {
        d("sidebar-color-brand");
    } else if (n.hasAttribute("data-sidebar") && n.getAttribute("data-sidebar") === "dark") {
        d("sidebar-color-dark");
    } else {
        d("sidebar-color-light");
    }

    if (document.getElementsByTagName("html")[0].hasAttribute("dir") && document.getElementsByTagName("html")[0].getAttribute("dir") === "rtl") {
        d("layout-direction-rtl");
    } else {
        d("layout-direction-ltr");
    }

    $("input[name='layout']").on("change", function () {
        window.location.href = $(this).val() === "vertical" ? "index.html" : "layouts-horizontal.html";
    });

    $("input[name='layout-mode']").on("change", function () {
        if ($(this).val() === "light") {
            document.body.setAttribute("data-bs-theme", "light");
            document.body.setAttribute("data-topbar", "light");
            if (n.hasAttribute("data-layout") && n.getAttribute("data-layout") === "horizontal") {
                document.body.setAttribute("data-sidebar", "dark");
                d("sidebar-color-dark");
            }
        } else {
            document.body.setAttribute("data-bs-theme", "dark");
            document.body.setAttribute("data-topbar", "dark");
            if (n.hasAttribute("data-layout") && n.getAttribute("data-layout") !== "horizontal") {
                document.body.setAttribute("data-sidebar", "dark");
            }
        }
    });

    $("input[name='layout-direction']").on("change", function () {
        if ($(this).val() === "ltr") {
            document.getElementsByTagName("html")[0].removeAttribute("dir");
            document.getElementById("bootstrap-style").setAttribute("href", "assets/css/bootstrap.min.css");
            document.getElementById("app-style").setAttribute("href", "assets/css/app.min.css");
        } else {
            document.getElementById("bootstrap-style").setAttribute("href", "assets/css/bootstrap-rtl.min.css");
            document.getElementById("app-style").setAttribute("href", "assets/css/app-rtl.min.css");
            document.getElementsByTagName("html")[0].setAttribute("dir", "rtl");
        }
    });

    Waves.init();

    $("#checkAll").on("change", function () {
        $(".table-check .form-check-input").prop("checked", $(this).prop("checked"));
    });

    $(".table-check .form-check-input").change(function () {
        if ($(".table-check .form-check-input:checked").length == $(".table-check .form-check-input").length) {
            $("#checkAll").prop("checked", true);
        } else {
            $("#checkAll").prop("checked", false);
        }
    });
})(jQuery);
