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
                    console.log("Fetched onboarding steps:", steps);
                    const checklist = $('#onboardingChecklist');
                    checklist.empty();

                    let allCompleted = true;

                    steps.forEach(step => {
                        if (step.step && typeof step.completed === 'boolean') {
                            const isChecked = step.completed ? 'checked' : '';
                            if (!step.completed) allCompleted = false;

                            checklist.append(`
                                <li class="list-group-item checklist-card">
                                    <div class="card-body">
                                        <input type="checkbox" class="form-check-input" ${isChecked}>
                                        <img src="images/landing/logo-small.png" alt="Step Image">
                                        <span>${step.step}</span>
                                    </div>
                                </li>
                            `);
                        } else {
                            console.warn("Skipping invalid step:", step);
                        }
                    });

                    if (allCompleted) {
                        $('#completionMessage').show();
                    } else {
                        $('#completionMessage').hide();
                    }

                    // Handle changes when a user checks/unchecks a step
                    checklist.on('change', 'input[type="checkbox"]', function() {
                        const step = $(this).closest('.card-body').find('span').html(); // Get the HTML content of the span
                        const completed = $(this).is(':checked');

                        if (!step || typeof completed !== 'boolean') {
                            console.error("Invalid step or completion status. Cannot update.");
                            return;
                        }

                        $.ajax({
                            url: '/auth/api/onboarding-step',
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            data: JSON.stringify({ step, completed }),
                            contentType: 'application/json',
                            success: function(response) {
                                if (response.allCompleted) {
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