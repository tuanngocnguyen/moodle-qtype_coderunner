// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * JavaScript for handling UI actions in the question authoring form.
 *
 * @package    qtype
 * @subpackage coderunner
 * @copyright  Richard Lobb, 2015, The University of Canterbury
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define(['jquery'], function($) {

    // Define a mapping from the fields of the JSON object returned by an AJAX
    // 'get question type' request to the form elements. Keys are JSON field
    // names, values are a 3- or 4-element array of: a jQuery form element selector;
    // the element property to be set; a default value if the JSON field is
    // empty and an optional filter function to apply to the field value before
    // setting the property with it.
    var JSON_TO_FORM_MAP = {
        template:            ['#id_template', 'value', ''],
        iscombinatortemplate:['#id_iscombinatortemplate', 'checked', '',
                                function (value) {
                                    return value === '1' ? true : false;
                                }],  // Need nice clean boolean for 'checked' attribute.
        cputimelimitsecs:    ['#id_cputimelimitsecs', 'value', ''],
        memlimitmb:          ['#id_memlimitmb', 'value', ''],
        sandbox:             ['#id_sandbox', 'value', 'DEFAULT'],
        sandboxparams:       ['#id_sandboxparams', 'value', ''],
        testsplitterre:      ['#id_testsplitterre', 'value', '',
                                function (splitter) {
                                    return splitter.replace('\n', '\\n');
                                }],
        allowmultiplestdins: ['#id_allowmultiplestdins', 'checked', '',
                                function (value) {
                                    return value === '1' ? true : false;
                                }],
        grader:              ['#id_grader', 'value', 'EqualityGrader'],
        resultcolumns:       ['#id_resultcolumns', 'value', ''],
        language:            ['#id_language', 'value', ''],
        acelang:             ['#id_acelang', 'value', ''],
        uiplugin:            ['#id_uiplugin', 'value', 'ace']
    };

    // Postpone initialisation until document ready, because strings_for_js
    // strings aren't defined at the time this is called.
    function initEditForm() {
        $().ready(initEditFormWhenReady);
    }

    function initEditFormWhenReady() {
        var typeCombo = $('#id_coderunnertype'),
            template = $('#id_template'),
            useace = $('#id_useace'),
            language = $('#id_language'),
            acelang = $('#id_acelang'),
            customise = $('#id_customise'),
            isCombinator = $('#id_iscombinatortemplate'),
            testSplitterRe = $('#id_testsplitterre'),
            allowMultipleStdins = $('#id_allowmultiplestdins'),
            customisationFieldSet = $('#id_customisationheader'),
            advancedCustomisation = $('#id_advancedcustomisationheader'),
            isCustomised = customise.prop('checked'),
            prototypeType = $('#id_prototypetype'),
            preloadHdr = $('#id_answerpreloadhdr'),
            typeName = $('#id_typename'),
            courseId = $('input[name="courseid"]').prop('value'),
            questiontypeHelpDiv = $('#qtype-help'),
            precheck = $('select#id_precheck'),
            testtypedivs = $('div.testtype'),
            uiplugin = $('#id_uiplugin');


        // Set up the UI controller for the textarea whose name is
        // given as the first parameter (one of template, answer or answerpreload)
        // to the given UI controller (which may be "None" or, equivalently, empty).
        function setUi(taName, uiname) {
            var taId = 'id_' + taName,
                ta = $('#' + taId),  // The jquery text area element(s)
                currentUi,
                lang;

            uiname = uiname.toLowerCase();
            if (uiname === 'none') {
                uiname = '';
            }

            if (ta) {
                currentUi = ta.data('current-ui'); // Currently-active UI on this ta
                if (currentUi && currentUi !== uiname) {
                    require(['qtype_coderunner/ui_' + currentUi], function(interface) {
                        interface.destroyInstance(taId); // Stop the current UI
                    });
                    ta.data('current-ui', '');
                }

                if (uiname === "ace") {
                    // The Ace UI needs a language. Use the value specified in 'acelang'
                    // for all fields other than the template, if the value is defined,
                    // or the value in 'language' in all other cases.
                    lang = language.prop('value');
                    if (taName !== "template" && acelang.prop('value')) {
                        lang =  acelang.prop('value');
                    }
                    require(['qtype_coderunner/ui_ace'], function(aceInterface) {
                        aceInterface.init(taId, lang);
                    });
                } else if (uiname && uiname !== currentUi) {
                    require(['qtype_coderunner/ui_' + uiname], function(aceInterface) {
                        aceInterface.init(taId);
                    });
                }

                ta.data('current-ui', uiname);
            }
        }

        // Set the correct Ui controller on both the sample answer and the answer preload
        function setUis() {
            var uiname = uiplugin.val();

            setUi('answer', uiname);
            setUi('answerpreload', uiname);
        }


        // Display or Hide all customisation parts of the form according
        // to whether isVisible is true or false respectively.
        function setCustomisationVisibility(isVisible) {
            var display = isVisible ? 'block' : 'none';
            customisationFieldSet.css('display', display);
            advancedCustomisation.css('display', display);
            if (isVisible && useace.prop('checked')) {
                setUi('template', 'ace');
            }
        }

        // After loading the form with new question type data we have to
        // enable or disable both the testsplitterre and the allow multiple
        // stdins field. These are subsequently enabled/disabled via event handlers
        // set up by code in edit_coderunner_form.php (q.v.) but those event
        // handlers do not handle the freshly downloaded state.
        function enableTemplateSupportFields() {
            var isCombinatorEnabled = isCombinator.prop('checked');

            testSplitterRe.prop('disabled', !isCombinatorEnabled);
            allowMultipleStdins.prop('disabled', !isCombinatorEnabled);
        }

        // Copy fields from the AJAX "get question type" response into the form.
        function copyFieldsFromQuestionType(newType, response) {
            var formspecifier, attrval, filter;
            for (var key in JSON_TO_FORM_MAP) {
                formspecifier = JSON_TO_FORM_MAP[key];
                attrval = response[key] ? response[key] : formspecifier[2];
                if (formspecifier.length > 3) {
                    filter = formspecifier[3];
                    attrval = filter(attrval);
                }
                $(formspecifier[0]).prop(formspecifier[1], attrval);
            }

            typeName.prop('value', newType);
            customise.prop('checked', false);
            questiontypeHelpDiv.html(detailsHtml(newType, response.questiontext));
            setCustomisationVisibility(false);
            enableTemplateSupportFields();
        }

        // A JSON request for a question type returned a 'failure' response - probably a
        // missing question type. Report the error with an alert, and replace
        // the template contents with an error message in case the user
        // saves the question and later wonders why it breaks.
        function reportError(questionType, error) {
            var errorMessage;
            window.alert(getString('prototype_load_failure') + error);
            errorMessage = getString('prototype_error') + "\n";
            errorMessage += error + '\n';
            errorMessage += "CourseId: " + courseId + ", qtype: " + questionType;
            template.prop('value', errorMessage);
        }

        function detailsHtml(title, html) {
            // Local function to return the HTML to display in the
            // question type details section of the form.
            var resultHtml = '<p class="question-type-details-header">';
            resultHtml += getString('coderunner_question_type');
            resultHtml += title + '</p>\n' + html;
            return resultHtml;

        }

        // Compact call to M.util.get_string.
        function getString(key) {
            return M.util.get_string(key, 'qtype_coderunner');
        }

        // Load the various customisation fields into the form from the
        // CodeRunner question type currently selected by the combobox.
        function loadCustomisationFields() {
            var newType = typeCombo.children('option:selected').text();

            if (newType !== '' && newType !== 'Undefined') {
                // Prevent 'Undefined' ever being reselected.
                typeCombo.children('option:first-child').prop('disabled', 'disabled');

                // Load question type with ajax.
                $.getJSON(M.cfg.wwwroot + '/question/type/coderunner/ajax.php',
                    {
                        qtype: newType,
                        courseid: courseId,
                        sesskey: M.cfg.sesskey
                    },
                    function (outcome) {
                        if (outcome.success) {
                            copyFieldsFromQuestionType(newType, outcome);
                            setUis();
                        }
                        else {
                            reportError(newType, outcome.error);
                        }

                    }
                ).fail(function () {
                    // AJAX failed. We're dead, Fred.
                    window.alert(getString('error_loading_prototype'));
                    template.prop('value', getString('ajax_error'));
                });
            }
        }

        // Show/hide all testtype divs in the testcases according to the
        // 'Precheck' selector.
        function set_testtype_visibilities() {
            if (precheck.val() === '3') { // Show only for case of 'Selected'.
                testtypedivs.show();
            } else {
                testtypedivs.hide();
            }
        }

        /*************************************************************
         *
         * Body of initEditFormWhenReady starts here.
         *
         *************************************************************/

        if (prototypeType.prop('value') == 1) {
            // Editing a built-in question type: Dangerous!
            window.alert(getString('proceed_at_own_risk'));
            prototypeType.prop('disabled', true);
            typeCombo.prop('disabled', true);
            customise.prop('disabled', true);
        }

        setUis();  // Set up UI controllers on answer and answerpreload

        setCustomisationVisibility(isCustomised);
        if (!isCustomised) {
            loadCustomisationFields();
        } else {
            questiontypeHelpDiv.html("<p>" + getString('info_unavailable') + "</p>");
        }

        set_testtype_visibilities();

        // Set up event Handlers.

        customise.on('change', function() {
            var isCustomised = customise.prop('checked');
            if (isCustomised) {
                // Customisation is being turned on.
                setCustomisationVisibility(true);
            } else { // Customisation being turned off.
                if (window.confirm(getString('confirm_proceed'))) {
                    setCustomisationVisibility(false);
                } else {
                    customise.prop('checked', true);
                }
            }
        });

        acelang.on('change', function() {
            if (uiplugin.val() === 'ace'){
                setUis();
            }
        });

        typeCombo.on('change', function() {
            if (!customise.prop('checked') ||
                    window.confirm(getString('question_type_changed'))) {
                loadCustomisationFields();
            }
        });

        useace.on('change', function() {
            var isTurningOn = useace.prop('checked');
            if (isTurningOn) {
                setUi('template', 'ace');
            } else {
                setUi('template', '');
            }
        });

        uiplugin.on('change', setUis);

        precheck.on('change', set_testtype_visibilities);

        // In order to initialise the Ui plugin when the answer preload section is
        // expanded, we monitor attribute mutations in the Answer Preload
        // header.
        var observer = new MutationObserver( function () {
            setUis();
        });
        observer.observe(preloadHdr.get(0), {'attributes': true});

        // Setup click handler for the buttons that allow users to replace the
        // expected output  with the output got from testing the answer program.
        $('button.replaceexpectedwithgot').click(function() {
            var gotPre = $(this).prev('pre[id^="id_got_"]');
            var testCaseId = gotPre.attr('id').replace('id_got_', '');
            $('#id_expected_' + testCaseId).val(gotPre.text());
            $('#id_fail_expected_' + testCaseId).html(gotPre.text());
            $('.failrow_' + testCaseId).addClass('fixed');  // Fixed row
            $(this).prop('disabled', true);
        });
    }

    return {initEditForm: initEditForm};
});