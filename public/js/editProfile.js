$(document).ready(function() {
            $('#editProfileForm').submit(function(e) {
                e.preventDefault();

                const form = $(this);
                const token = localStorage.getItem('token');
                const formData = form.serialize();

                $.ajax({
                    url: form.attr('action'),
                    method: form.attr('method'),
                    data: formData,
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    success: function(response) {
                        console.log('Profile updated successfully', response);
                        const saveButton = form.find('button[type="submit"]');
                        saveButton.text('Saved!').removeClass('btn-danger').addClass('btn-success');

                        if (response.user && response.user.firstName) {
                             $('#firstnamePlaceholder').text(`Hello, ${response.user.firstName}`);
                             $('#userFirstName').text(response.user.firstName);
                        }

                        setTimeout(function() {
                            saveButton.text('Save changes').removeClass('btn-success');
                        }, 2000);
                    },
                    error: function(error) {
                        console.error('Error updating profile:', error);
                        const saveButton = form.find('button[type="submit"]');
                        saveButton.text('Error!').removeClass('btn-success').addClass('btn-danger');

                        setTimeout(function() {
                            saveButton.text('Save changes').removeClass('btn-danger');
                        }, 3000);
                    }
                });
            });

            const token = localStorage.getItem('token');
            if (!token) {
                console.error("No token available. Redirecting to login.");
                window.location.href = '/login.html';
                return;
            }

            console.log("Fetching onboarding steps...");

            // Fetch the onboarding steps from the backend
            $.ajax({
                url: '/auth/api/onboarding-steps',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                success: function(steps) {
                    console.log("Full onboarding steps data received from server:", JSON.stringify(steps, null, 2));
                    const checklist = $('#onboardingChecklist');
                    checklist.empty();

                    steps.forEach(step => {
                        if (step.title && step.icon && typeof step.completed === 'boolean') {
                            const isChecked = step.completed ? 'checked' : '';
                            
                            let iconClasses = `fa ${step.icon}`;
                            if (step.animate && !step.completed) {
                                iconClasses += ' fa-spin';
                            }

                            let stepHtml = `
                                <li class="list-group-item checklist-item" data-step-title="${step.title}">
                                    <div class="checklist-item-content">
                                        <div class="checklist-icon">
                                            <i class="${iconClasses}"></i>
                                        </div>
                                        <div class="checklist-text">
                                            <h5>${step.title}</h5>
                                            <p>${step.description}</p>`;
                            
                            if (step.templateLink) {
                                stepHtml += `<p>If you need the template, download it <a href="files/template.xlsx" download="template.xlsx"><i class="fa fa-download"></i> here</a>.</p>`;
                            }
                    
                            stepHtml += `
                                        </div>
                                        <div class="checklist-checkbox">
                                            <input type="checkbox" class="form-check-input" ${isChecked}>
                                        </div>
                                    </div>
                                </li>`;
                    
                            const listItem = $(stepHtml);
                            if (step.completed) {
                                listItem.addClass('completed');
                            }
                            checklist.append(listItem);
                        } else {
                            console.warn("Skipping invalid step:", step);
                        }
                    });

                    // We need to re-check completion status after rendering
                    const allSteps = checklist.find('.checklist-item');
                    const completedSteps = checklist.find('.checklist-item.completed');
                    
                    if (allSteps.length > 0 && allSteps.length === completedSteps.length) {
                        $('#completionMessage').show();
                    } else {
                        $('#completionMessage').hide();
                    }

                    // Handle changes when a user checks/unchecks a step
                    checklist.on('change', 'input[type="checkbox"]', function() {
                        const title = $(this).closest('.checklist-item').data('step-title');
                        const completed = $(this).is(':checked');

                        const listItem = $(this).closest('.checklist-item');
                        if (completed) {
                            listItem.addClass('completed');
                        } else {
                            listItem.removeClass('completed');
                        }

                        const stepData = steps.find(s => s.title === title);
                        if (stepData && stepData.icon && stepData.animate) {
                            const icon = listItem.find('.checklist-icon i');
                            if (completed) {
                                icon.removeClass('fa-spin');
                            } else {
                                icon.addClass('fa-spin');
                            }
                        }

                        if (!title || typeof completed !== 'boolean') {
                            console.error("Invalid step or completion status. Cannot update.");
                            return;
                        }

                        $.ajax({
                            url: '/auth/api/onboarding-step',
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            data: JSON.stringify({ title, completed }),
                            contentType: 'application/json',
                            success: function(response) {
                                const allSteps = checklist.find('.checklist-item');
                                const completedSteps = checklist.find('.checklist-item.completed');
                                if (allSteps.length === completedSteps.length) {
                                    $('#completionMessage').show();
                                } else {
                                    $('#completionMessage').hide();
                                }
                            },
                            error: function(error) {
                                console.error("Error updating onboarding step:", error);
                            }
                        });
                    });
                },
                error: function(error) {
                    console.error("Error fetching onboarding steps:", error);
                }
            });
        });