import React, { ChangeEvent, ReactNode, forwardRef, isValidElement } from 'react';
import { 
  Input, 
  InputGroup, 
  InputProps, 
  InputGroupProps, 
  InputLeftElement, 
  InputRightElement,
  IconButton,
  useColorModeValue,
  InputLeftAddon,
  InputRightAddon
} from '@chakra-ui/react';
import { SmallCloseIcon } from '@chakra-ui/icons';


type InputVariant = 'outline' | 'filled' | 'flushed' | 'unstyled';

type InputWithIconProps = {
  /** The current value of the input */
  value: string;
  /** Callback when input value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Icon to display on the left side of the input */
  leftIcon?: ReactNode;
  /** Icon to display on the right side of the input. Must be a valid React element. */
  rightIcon?: React.ReactElement;
  /** Text to display as left addon */
  leftAddon?: ReactNode;
  /** Text to display as right addon */
  rightAddon?: ReactNode;
  /** Show clear button when input has value */
  showClearButton?: boolean;
  /** Custom clear button icon. Must be a valid React element. */
  clearButtonIcon?: React.ReactElement;
  /** Callback when clear button is clicked */
  onClear?: () => void;
  /** Input variant */
  variant?: InputVariant;
  /** Additional input props */
  inputProps?: Omit<InputProps, 'onChange' | 'value' | 'placeholder' | 'variant'>;
} & Omit<InputGroupProps, 'children' | 'onChange'>;

/**
 * A customizable input component with icon support, clear button, and addons.
 * Built on top of Chakra UI's Input component with enhanced functionality.
 */
const InputWithIcon = forwardRef<HTMLInputElement, InputWithIconProps>(({
  value,
  onChange,
  placeholder = '',
  leftIcon,
  rightIcon,
  leftAddon,
  rightAddon,
  showClearButton = true,
  clearButtonIcon = <SmallCloseIcon /> as React.ReactElement,
  onClear,
  variant = 'outline',
  inputProps = {},
  ...props
}, ref) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  const showClearBtn = showClearButton && value && !inputProps.isDisabled && !inputProps.isReadOnly;
  const defaultIconColor = useColorModeValue('gray.500', 'gray.400');
  const clearButtonColor = useColorModeValue('gray.400', 'gray.500');

  return (
    <InputGroup {...props}>
      {leftAddon && <InputLeftAddon>{leftAddon}</InputLeftAddon>}
      
      {leftIcon && (
        <InputLeftElement pointerEvents="none" color={defaultIconColor}>
          {leftIcon}
        </InputLeftElement>
      )}
      
      <Input
        ref={ref}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        pl={leftIcon ? '2.5rem' : undefined}
        pr={showClearBtn || rightIcon ? '2.5rem' : undefined}
        variant={variant}
        {...inputProps}
      />
      
      {showClearBtn && (
        <InputRightElement>
          <IconButton
            aria-label="Clear input"
            size="xs"
            variant="ghost"
            colorScheme="gray"
            color={clearButtonColor}
            onClick={handleClear}
            icon={clearButtonIcon || <SmallCloseIcon />}
            _hover={{ color: 'gray.600' }}
          />
        </InputRightElement>
      )}
      {!showClearBtn && rightIcon && (
        <InputRightElement>
          {rightIcon}
        </InputRightElement>
      )}
      
      {rightAddon && <InputRightAddon>{rightAddon}</InputRightAddon>}
    </InputGroup>
  );
});

InputWithIcon.displayName = 'InputWithIcon';

export default InputWithIcon;
